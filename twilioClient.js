// twilioClient.js
import twilio from 'twilio';

const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const serviceSid = process.env.TWILIO_SERVICE_SID;

console.log('Using TWILIO_SERVICE_SID:', serviceSid);

const client = twilio(accountSid, authToken);

// Send OTP via SMS or WhatsApp
// channel can be 'sms' or 'whatsapp'
export const sendOTP = (phoneNumber, channel = 'sms') => {
  console.log(`Sending OTP to: ${phoneNumber} via ${channel}`);
  return client.verify.v2
    .services(serviceSid)
    .verifications
    .create({
      to: phoneNumber,
      channel: channel,  // 'sms' or 'whatsapp'
    });
};

// Verify OTP (same for both SMS and WhatsApp)
export const verifyOTP = (phoneNumber, code) => {
  console.log('Verifying OTP for:', phoneNumber, 'code:', code);
  return client.verify.v2
    .services(serviceSid)
    .verificationChecks
    .create({
      to: phoneNumber,
      code: code,
    });
};