import axios from 'axios';
import { env } from '../config/env';

export const bkashService = {
  async getAccessToken(): Promise<string> {
    const response = await axios.post(
      'https://tokenization.bkash.com/tokenization/token',
      {
        client_id: env.bkashClientId,
        client_secret: env.bkashClientSecret,
        grant_type: 'client_credentials',
      },
      {
        headers: {
          'Content-Type': 'application/json',
        },
        timeout: 15000,
      }
    );

    return response.data.access_token;
  },

  async initiateSTKPush(
    phoneNumber: string,
    amount: number,
    transactionId: string,
    purpose: string = 'Rup Try-On Payment'
  ): Promise<any> {
    const accessToken = await this.getAccessToken();

    const response = await axios.post(
      'https://api.bkash.com/external/checkouth5/v1.2/push',
      {
        mode: '01',
        payer_vendor_code: env.bkashProviderCode,
        payer_msisdn: phoneNumber,
        amount,
        currency: 'BDT',
        transaction_id: transactionId,
        purpose,
        callback_url: 'https://your-domain.com/api/bkash/callback',
      },
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        timeout: 30000,
      }
    );

    return response.data;
  },

  async checkStatus(transactionId: string): Promise<any> {
    const accessToken = await this.getAccessToken();

    const response = await axios.get(
      `https://api.bkash.com/external/checkouth5/v1.2/status/${transactionId}`,
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
        },
        timeout: 15000,
      }
    );

    return response.data;
  },
};