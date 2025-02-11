import { supabase } from './supabase';
import { formatAddress } from './wallet';
import { MD5 } from 'crypto-js';

// API configuration for temp-mail.org
const EMAIL_API = {
  baseUrl: 'https://api.temp-mail.org/request',
  format: 'json',
  defaultDomain: 'temp-mail.org'
};

// Adjectives and nouns for username generation
const ADJECTIVES = [
  'swift', 'brave', 'mighty', 'noble', 'wise', 'royal', 'solar', 'lunar', 'cosmic',
  'mystic', 'golden', 'silver', 'crystal', 'shadow', 'storm', 'frost', 'thunder',
  'stellar', 'astral', 'phoenix'
];

const NOUNS = [
  'warrior', 'knight', 'sage', 'dragon', 'wolf', 'eagle', 'lion', 'tiger', 'bear',
  'falcon', 'hawk', 'raven', 'phoenix', 'hunter', 'ranger', 'guardian', 'sentinel',
  'warden', 'keeper', 'champion'
];

// Generate a unique username
function generateUsername(): string {
  const adjective = ADJECTIVES[Math.floor(Math.random() * ADJECTIVES.length)];
  const noun = NOUNS[Math.floor(Math.random() * NOUNS.length)];
  const number = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
  return `${adjective}${noun}${number}`;
}

// Generate a profile picture URL using DiceBear
function generateProfilePicture(username: string): string {
  return `https://api.dicebear.com/7.x/pixel-art/svg?seed=${username}&backgroundColor=b6e3f4,c0aede,d1d4f9&radius=50`;
}

// Helper function to make API requests with retries
async function fetchWithRetry(url: string, options: RequestInit = {}, retries = 3): Promise<Response> {
  let lastError: Error | null = null;

  for (let i = 0; i < retries; i++) {
    try {
      const response = await fetch(url, {
        ...options,
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
          ...options.headers
        }
      });

      // 404 is a valid response for no emails
      if (response.ok || response.status === 404) {
        return response;
      }

      const errorText = await response.text();
      throw new Error(`HTTP error! status: ${response.status}, message: ${errorText}`);
    } catch (error) {
      lastError = error instanceof Error ? error : new Error('Unknown error');
      console.warn(`Attempt ${i + 1} failed:`, lastError.message);

      if (i === retries - 1) {
        throw lastError;
      }

      // Exponential backoff
      await new Promise(resolve => setTimeout(resolve, Math.pow(2, i) * 1000));
    }
  }

  throw lastError || new Error('Failed after retries');
}

// Generate a temporary email for a wallet
export async function generateTempEmail(walletId: string): Promise<string | null> {
  try {
    // Get wallet details
    const { data: wallet, error: fetchError } = await supabase
      .from('wallets')
      .select('address, email, username')
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
    const username = formatAddress(wallet.address)
      .replace('0x', '')
      .replace('...', 'x')
      .toLowerCase();
    const email = `${username}@${EMAIL_API.defaultDomain}`;
    const emailHash = MD5(email.toLowerCase()).toString();

    // Generate unique username if not exists
    const dappUsername = wallet.username || generateUsername();
    const profilePictureUrl = generateProfilePicture(dappUsername);

    // Update wallet with email and profile details
    const { error: updateError } = await supabase
      .from('wallets')
      .update({
        email,
        email_hash: emailHash,
        email_domain: EMAIL_API.defaultDomain,
        email_created_at: new Date().toISOString(),
        username: dappUsername,
        profile_picture_url: profilePictureUrl
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

    if (fetchError || !wallet?.email || !wallet?.email_hash) {
      console.error('Failed to fetch wallet email:', fetchError);
      return [];
    }

    // Fetch emails from temp-mail API
    const response = await fetchWithRetry(
      `${EMAIL_API.baseUrl}/mail/id/${wallet.email_hash}/format/${EMAIL_API.format}/`
    );

    if (response.status === 404) {
      // No emails is a normal condition
      return [];
    }

    const data = await response.json();
    return Array.isArray(data) ? data : [];
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
      .select('email_hash')
      .eq('id', walletId)
      .single();

    if (fetchError || !wallet?.email_hash) {
      console.error('Failed to fetch wallet email:', fetchError);
      return null;
    }

    // Fetch specific email message
    const response = await fetchWithRetry(
      `${EMAIL_API.baseUrl}/source/id/${messageId}/format/${EMAIL_API.format}/`
    );

    if (!response.ok) {
      throw new Error('Failed to fetch email message');
    }

    const data = await response.json();
    return {
      mail_id: messageId,
      mail_from: data.from,
      mail_subject: data.subject,
      mail_text: data.text || data.html,
      mail_timestamp: data.date
    };
  } catch (error) {
    console.error('Error fetching email message:', error);
    return null;
  }
}

// Delete a specific email message
export async function deleteEmailMessage(walletId: string, messageId: string): Promise<boolean> {
  try {
    // Delete email message using temp-mail API
    const response = await fetchWithRetry(
      `${EMAIL_API.baseUrl}/delete/id/${messageId}/format/${EMAIL_API.format}/`
    );

    return response.ok;
  } catch (error) {
    console.error('Error deleting email message:', error);
    return false;
  }
}