import twilio from 'twilio';

const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const serviceSid = process.env.TWILIO_SERVICE_SID; // Twilio Verify Service SID

const client = twilio(accountSid, authToken);

export const sendOTP = (phoneNumber) => {
  return client.verify.services(serviceSid)
    .verifications
    .create({ to: phoneNumber, channel: 'sms' });
};

export const verifyOTP = (phoneNumber, code) => {
  return client.verify.services(serviceSid)
    .verificationChecks
    .create({ to: phoneNumber, code });
};