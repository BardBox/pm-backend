/**
 * Service for cross-backend communication with bizcivitas-backend
 * Used to check existing members and sync PM-converted members to main DB
 */

const getBizcivitasBackendUrl = () =>
    process.env.BIZCIVITAS_BACKEND_URL || "https://backend.bizcivitas.com";

const getInternalApiKey = () => process.env.INTERNAL_API_KEY || "";

const callInternalApi = async (path, body) => {
    const url = `${getBizcivitasBackendUrl()}/api/v1/internal${path}`;

    const response = await fetch(url, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "x-internal-api-key": getInternalApiKey(),
        },
        body: JSON.stringify(body),
    });

    const data = await response.json();
    return { status: response.status, data };
};

/**
 * Check if an email or phone belongs to an existing BizCivitas member (main backend)
 * @param {string} email
 * @param {string} [phone]
 * @returns {{ isMember: boolean, membershipType?: string, name?: string, userId?: string }}
 */
export const checkExistingMember = async (email, phone) => {
    try {
        const { status, data } = await callInternalApi("/check-member", { email, phone });
        if (status === 200 && data?.data) {
            return data.data;
        }
        return { isMember: false };
    } catch (err) {
        // Fail open — don't block inquiry submission if main backend is unreachable
        console.error("[BizCivitas Internal] checkExistingMember failed:", err.message);
        return { isMember: false };
    }
};

/**
 * Sync a newly converted PM member to the main BizCivitas backend
 * @param {object} memberData - { fname, lname, email, mobile, state, city, password,
 *                                razorpayPaymentId, razorpayOrderId, razorpaySignature, amount }
 * @returns {{ created: boolean, alreadyExists: boolean, userId?: string }}
 */
export const syncMemberToMainBackend = async (memberData) => {
    const { status, data } = await callInternalApi("/create-member", memberData);
    if (status === 201 || status === 200) {
        return data?.data || {};
    }
    throw new Error(`Main backend sync failed — status ${status}: ${data?.message}`);
};
