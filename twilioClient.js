import twilio from 'twilio';

const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const serviceSid = process.env.TWILIO_SERVICE_SID;

console.log('Using TWILIO_SERVICE_SID:', serviceSid);

const client = twilio(accountSid, authToken);

// Send OTP
export const sendOTP = (phoneNumber) => {
  console.log('Sending OTP to:', phoneNumber);
  return client.verify.v2
    .services(serviceSid)
    .verifications
    .create({
      to: phoneNumber,
      channel: 'sms',
    });
};

// Verify OTP
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