import { supabase } from './supabase';
import { formatAddress } from './wallet';
import { MD5 } from 'crypto-js';

// API configuration
const TEMP_MAIL_API = {
  baseUrl: 'https://privatix-temp-mail-v1.p.rapidapi.com/request',
  host: 'privatix-temp-mail-v1.p.rapidapi.com'
};

// List of available temp mail domains
const TEMP_MAIL_DOMAINS = [
  'mailto.plus',
  'freeml.net',
  'rover.info'
];

// Get API key from Supabase
async function getTempMailApiKey(): Promise<string> {
  const { data, error } = await supabase
    .from('api_keys')
    .select('key')
    .eq('provider', 'tempmail')
    .eq('is_active', true)
    .single();

  if (error || !data?.key) {
    throw new Error('Failed to get TempMail API key');
  }

  return data.key;
}

// Generate a random domain from the available list
function getRandomDomain(): string {
  const index = Math.floor(Math.random() * TEMP_MAIL_DOMAINS.length);
  return TEMP_MAIL_DOMAINS[index];
}

// Generate MD5 hash for email
function generateEmailHash(email: string): string {
  return MD5(email.toLowerCase().trim()).toString();
}

// Generate a temporary email for a wallet
export async function generateTempEmail(walletId: string): Promise<string | null> {
  try {
    // Get wallet details
    const { data: wallet, error: fetchError } = await supabase
      .from('wallets')
      .select('address, email')
      .eq('id', walletId)
      .single();

    if (fetchError || !wallet) {
      console.error('Failed to fetch wallet:', fetchError);
      return null;
    }

    // Check if wallet already has an email
    if (wallet.email) {
      return wallet.email;
    }

    // Generate email components
    const domain = getRandomDomain();
    const username = `${formatAddress(wallet.address).replace('...', 'x').toLowerCase()}`;
    const email = `${username}@${domain}`;
    const emailHash = generateEmailHash(email);

    // Update wallet with email details
    const { error: updateError } = await supabase
      .from('wallets')
      .update({
        email,
        email_hash: emailHash,
        email_domain: domain,
        email_created_at: new Date().toISOString()
      })
      .eq('id', walletId);

    if (updateError) {
      console.error('Failed to update wallet with email:', updateError);
      return null;
    }

    return email;
  } catch (error) {
    console.error('Error generating temp email:', error);
    return null;
  }
}

// Get emails for a wallet
export async function getWalletEmails(walletId: string): Promise<any[]> {
  try {
    // Get wallet email details
    const { data: wallet, error: fetchError } = await supabase
      .from('wallets')
      .select('email, email_hash')
      .eq('id', walletId)
      .single();

    if (fetchError || !wallet?.email_hash) {
      console.error('Failed to fetch wallet email:', fetchError);
      return [];
    }

    const apiKey = await getTempMailApiKey();

    // Fetch emails from Privatix API
    const response = await fetch(
      `${TEMP_MAIL_API.baseUrl}/mail/id/${wallet.email_hash}/`,
      { 
        headers: {
          'x-rapidapi-host': TEMP_MAIL_API.host,
          'x-rapidapi-key': apiKey
        }
      }
    );

    if (!response.ok) {
      throw new Error('Failed to fetch emails');
    }

    const emails = await response.json();
    return Array.isArray(emails) ? emails : [];
  } catch (error) {
    console.error('Error fetching wallet emails:', error);
    return [];
  }
}

// Get a specific email message
export async function getEmailMessage(walletId: string, messageId: string): Promise<any | null> {
  try {
    // Get wallet email details
    const { data: wallet, error: fetchError } = await supabase
      .from('wallets')
      .select('email, email_hash')
      .eq('id', walletId)
      .single();

    if (fetchError || !wallet?.email_hash) {
      console.error('Failed to fetch wallet email:', fetchError);
      return null;
    }

    const apiKey = await getTempMailApiKey();

    // Fetch specific email message
    const response = await fetch(
      `${TEMP_MAIL_API.baseUrl}/mail/id/${wallet.email_hash}/${messageId}/`,
      { 
        headers: {
          'x-rapidapi-host': TEMP_MAIL_API.host,
          'x-rapidapi-key': apiKey
        }
      }
    );

    if (!response.ok) {
      throw new Error('Failed to fetch email message');
    }

    return await response.json();
  } catch (error) {
    console.error('Error fetching email message:', error);
    return null;
  }
}

// Delete a specific email message
export async function deleteEmailMessage(walletId: string, messageId: string): Promise<boolean> {
  try {
    // Get wallet email details
    const { data: wallet, error: fetchError } = await supabase
      .from('wallets')
      .select('email, email_hash')
      .eq('id', walletId)
      .single();

    if (fetchError || !wallet?.email_hash) {
      console.error('Failed to fetch wallet email:', fetchError);
      return false;
    }

    const apiKey = await getTempMailApiKey();

    // Delete email message
    const response = await fetch(
      `${TEMP_MAIL_API.baseUrl}/delete/id/${wallet.email_hash}/${messageId}/`,
      { 
        method: 'DELETE',
        headers: {
          'x-rapidapi-host': TEMP_MAIL_API.host,
          'x-rapidapi-key': apiKey
        }
      }
    );

    return response.ok;
  } catch (error) {
    console.error('Error deleting email message:', error);
    return false;
  }
}