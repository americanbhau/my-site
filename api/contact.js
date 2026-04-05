// api/contact.js — Vercel serverless function
// Receives form submissions and writes contacts to Bird.com CRM

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { BIRD_API_KEY, BIRD_WORKSPACE_ID } = process.env;

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

  // Build the Bird.com contact payload
  const identifiers = [
    { key: 'emailaddress', value: email.trim().toLowerCase() },
  ];

  if (whatsapp && whatsapp.trim()) {
    // Normalize phone: strip spaces/dashes, ensure + prefix
    const phone = whatsapp.trim().replace(/[\s\-()]/g, '');
    identifiers.push({ key: 'phonenumber', value: phone });
  }

  const contactPayload = {
    displayName: name.trim(),
    identifiers,
    attributes: {
      businessName:  business.trim()  || '',
      businessType:  bizType?.trim()  || '',
      location:      location?.trim() || '',
      platforms:     platforms?.trim()|| '',
      goal:          goal?.trim()     || '',
      source:        'americanbhau-website',
      submittedAt:   new Date().toISOString(),
    },
  };

  try {
    const birdRes = await fetch(
      `https://api.bird.com/workspaces/${BIRD_WORKSPACE_ID}/contacts`,
      {
        method: 'POST',
        headers: {
          'Authorization': `AccessKey ${BIRD_API_KEY}`,
          'Content-Type':  'application/json',
        },
        body: JSON.stringify(contactPayload),
      }
    );

    const birdData = await birdRes.json();

    if (!birdRes.ok) {
      console.error('Bird API error:', birdData);
      return res.status(502).json({ error: 'Failed to save contact', detail: birdData });
    }

    return res.status(200).json({ success: true, contactId: birdData.id });

  } catch (err) {
    console.error('Unexpected error:', err);
    return res.status(500).json({ error: 'Unexpected server error' });
  }
}
