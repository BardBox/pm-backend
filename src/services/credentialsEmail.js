import nodemailer from "nodemailer";
import ApiErrors from "../utils/ApiErrors.js";

export const sendEmailWithCredentials = async (fname, email, password) => {
  const emailHtmlContentUser = `
  <div style="font-family: Arial, sans-serif; margin: 0; padding: 0; background-color: #f4f4f4; color: #333;">
    <div style="max-width: 600px; margin: 20px auto; background: #ffffff; border-radius: 8px; padding: 20px; box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);">
      <div style="text-align: center;">
        <img src="https://res.cloudinary.com/dkir8cvnf/image/upload/v1735815844/Bizcivitas_LOGO_1024_Px_fhqilx.jpg" alt="BizCivitas Logo" style="max-width: 150px; height: auto; margin-bottom: 20px;">
        <h1 style="font-size: 24px; color: #333; margin: 0 0 10px;">Welcome to BizCivitas</h1>
        <p style="font-size: 16px; color: #666; margin: 0 0 20px;">Dear ${fname},</p>
      </div>
      <div style="font-size: 16px; color: #333; line-height: 1.5; padding: 0 12px;">
        <p>Your account has been created successfully.</p>
        <p>Please use the login credentials below to access your BizCivitas account.</p>
      </div>
      <div style="font-size: 16px; color: #333; padding: 0 12px; margin-top: 10px;">
        <h2 style="font-size: 18px; color: #333; margin: 20px 0 10px;">Your Login Credentials:</h2>
        <ul style="margin: 0 0 20px; padding-left: 20px;">
          <li><b>Email:</b> <span style="color: #3459FF; font-weight: bold;">${email}</span></li>
          <li><b>Password:</b> <span style="color: #3459FF; font-weight: bold;">${password}</span></li>
        </ul>
        <p><b>Download the app:</b></p>
        <ul>
          <li><a href="https://play.google.com/store/apps/details?id=com.bizcivitas" style="color: #3459FF;">Android - Google Play Store</a></li>
          <li><a href="https://apps.apple.com/in/app/bizcivitas/id6748434171" style="color: #3459FF;">iOS - Apple App Store</a></li>
        </ul>
      </div>
      <div style="text-align: center; font-size: 14px; color: #666; padding: 20px 0; border-top: 1px solid #ddd; margin-top: 20px;">
        <p style="margin: 0;">Warm regards,</p>
        <p style="margin: 5px 0;"><b>Team BizCivitas</b></p>
        <p style="margin: 5px 0;"><a href="https://www.bizcivitas.com" style="color: #3459FF; text-decoration: none;">www.bizcivitas.com</a></p>
      </div>
    </div>
  </div>
  `;

  const transporter = nodemailer.createTransport({
    host: "smtp.gmail.com",
    port: 465,
    secure: true,
    auth: {
      user: process.env.CLIENT_EMAIL,
      pass: process.env.APP_PASSWORD_EMAIL,
    },
  });

  const mailOptions = {
    from: process.env.CLIENT_EMAIL,
    to: email,
    subject: "Your BizCivitas Login Credentials",
    html: emailHtmlContentUser,
  };

  try {
    await transporter.sendMail(mailOptions);
  } catch (error) {
    console.error("Error sending email:", error);
    throw new ApiErrors(500, "Failed to send email");
  }
};
