// api/contact.js — Vercel serverless function
// Receives form submissions, writes contacts to Bird.com CRM,
// and adds them to an existing list.

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { BIRD_API_KEY, BIRD_WORKSPACE_ID, BIRD_LIST_ID } = process.env;

  if (!BIRD_API_KEY || !BIRD_WORKSPACE_ID) {
    console.error('Missing BIRD_API_KEY or BIRD_WORKSPACE_ID env vars');
    return res.status(500).json({ error: 'Server configuration error' });
  }

  const {
    name,
    business,
    'biz-type': bizType,
    location,
    platforms,
    goal,
    email,
    whatsapp,
  } = req.body;

  // Basic validation
  if (!name || !email || !business) {
    return res.status(400).json({ error: 'Name, email, and business are required' });
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return res.status(400).json({ error: 'Invalid email address' });
  }

  const normalizedEmail = email.trim().toLowerCase();

  // Build the Bird.com contact payload
  const identifiers = [
    { key: 'emailaddress', value: normalizedEmail },
  ];

  if (whatsapp && whatsapp.trim()) {
    const phone = whatsapp.trim().replace(/[\s\-()]/g, '');
    identifiers.push({ key: 'phonenumber', value: phone });
  }

  const birdHeaders = {
    'Authorization': `AccessKey ${BIRD_API_KEY}`,
    'Content-Type':  'application/json',
  };

  try {
    // 1. Create (or upsert) the contact
    const contactRes = await fetch(
      `https://api.bird.com/workspaces/${BIRD_WORKSPACE_ID}/contacts`,
      {
        method: 'POST',
        headers: birdHeaders,
        body: JSON.stringify({ displayName: name.trim(), identifiers }),
      }
    );

    const contactData = await contactRes.json();

    if (!contactRes.ok && contactData.code !== 'ResourceAlreadyExists') {
      console.error('Bird contact creation error:', contactData);
      return res.status(502).json({ error: 'Failed to save contact', detail: contactData });
    }

    const existing = contactData.code === 'ResourceAlreadyExists';

    // 2. Add to list if BIRD_LIST_ID is configured
    if (BIRD_LIST_ID) {
      const listRes = await fetch(
        `https://api.bird.com/workspaces/${BIRD_WORKSPACE_ID}/lists/${BIRD_LIST_ID}/contacts`,
        {
          method: 'POST',
          headers: birdHeaders,
          body: JSON.stringify({ identifiers: [{ key: 'emailaddress', value: normalizedEmail }] }),
        }
      );

      if (!listRes.ok) {
        const listData = await listRes.json();
        // Log but don't fail the request — contact was already saved
        console.error('Bird list add error:', listData);
      }
    }

    return res.status(200).json({ success: true, existing });

  } catch (err) {
    console.error('Unexpected error:', err);
    return res.status(500).json({ error: 'Unexpected server error' });
  }
}
