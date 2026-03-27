const MAILERLITE_API_KEY = process.env.MAILERLITE_API_KEY;
const MAILERLITE_BASE_URL = "https://connect.mailerlite.com/api";
const MAILERLITE_GROUP_ID = process.env.MAILERLITE_GROUP_ID;

const headers = {
  Authorization: `Bearer ${MAILERLITE_API_KEY}`,
  "Content-Type": "application/json",
  Accept: "application/json",
};

export const createSubscriber = async ({ email, name, company, phone, city, state, source }) => {
  if (!MAILERLITE_API_KEY) {
    console.warn("[MailerLite] API key not configured, skipping subscriber creation");
    return null;
  }

  try {
    const body = {
      email: email.toLowerCase(),
      fields: {
        name: name || "",
        company: company || "",
        phone: phone || "",
        city: city || "",
        state: state || "",
      },
    };

    if (MAILERLITE_GROUP_ID) {
      body.groups = [MAILERLITE_GROUP_ID];
    }

    const response = await fetch(`${MAILERLITE_BASE_URL}/subscribers`, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error("[MailerLite] Failed to create subscriber:", data);
      return { success: false, error: data };
    }

    console.log(`[MailerLite] Subscriber created/updated: ${email}`);
    return { success: true, data };
  } catch (error) {
    console.error("[MailerLite] Error creating subscriber:", error.message);
    return { success: false, error: error.message };
  }
};

export const getSubscriber = async (email) => {
  if (!MAILERLITE_API_KEY) return null;

  try {
    const response = await fetch(
      `${MAILERLITE_BASE_URL}/subscribers/${encodeURIComponent(email)}`,
      { headers }
    );

    if (!response.ok) return null;
    return await response.json();
  } catch (error) {
    console.error("[MailerLite] Error fetching subscriber:", error.message);
    return null;
  }
};

export const listGroups = async () => {
  if (!MAILERLITE_API_KEY) return [];

  try {
    const response = await fetch(`${MAILERLITE_BASE_URL}/groups?limit=50`, { headers });
    if (!response.ok) return [];
    const data = await response.json();
    return data.data || [];
  } catch (error) {
    console.error("[MailerLite] Error listing groups:", error.message);
    return [];
  }
};

export const getCampaigns = async (limit = 25) => {
  if (!MAILERLITE_API_KEY) return [];

  try {
    const response = await fetch(
      `${MAILERLITE_BASE_URL}/campaigns?filter[status]=sent&limit=${limit}`,
      { headers }
    );
    if (!response.ok) return [];
    const data = await response.json();
    return data.data || [];
  } catch (error) {
    console.error("[MailerLite] Error fetching campaigns:", error.message);
    return [];
  }
};

export const getSubscriberActivity = async (subscriberId) => {
  if (!MAILERLITE_API_KEY) return [];

  try {
    const response = await fetch(
      `${MAILERLITE_BASE_URL}/subscribers/${subscriberId}/activity`,
      { headers }
    );
    if (!response.ok) return [];
    const data = await response.json();
    return data.data || [];
  } catch (error) {
    console.error("[MailerLite] Error fetching activity:", error.message);
    return [];
  }
};
