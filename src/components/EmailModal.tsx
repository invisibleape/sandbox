import React, { useState, useEffect } from 'react';
import { X, Loader2, Mail, Trash2, RefreshCw, Copy, CheckCircle, User } from 'lucide-react';
import { generateTempEmail, getWalletEmails, getEmailMessage, deleteEmailMessage } from '../lib/email';
import { supabase } from '../lib/supabase';

interface Email {
  _id: string;
  mail_id: string;
  mail_from: string;
  mail_subject: string;
  mail_text: string;
  mail_timestamp: string;
}

interface EmailModalProps {
  isOpen: boolean;
  onClose: () => void;
  walletId: string | null;
}

interface WalletProfile {
  email: string | null;
  username: string | null;
  profile_picture_url: string | null;
}

export function EmailModal({ isOpen, onClose, walletId }: EmailModalProps) {
  const [isGenerating, setIsGenerating] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [email, setEmail] = useState<string | null>(null);
  const [emails, setEmails] = useState<Email[]>([]);
  const [selectedEmail, setSelectedEmail] = useState<Email | null>(null);
  const [copiedEmail, setCopiedEmail] = useState(false);
  const [profile, setProfile] = useState<WalletProfile | null>(null);

  useEffect(() => {
    if (isOpen && walletId) {
      loadEmailStatus();
    } else {
      setEmail(null);
      setEmails([]);
      setSelectedEmail(null);
      setError(null);
      setProfile(null);
    }
  }, [isOpen, walletId]);

  const loadEmailStatus = async () => {
    if (!walletId) return;
    
    setIsLoading(true);
    try {
      const { data: wallet } = await supabase
        .from('wallets')
        .select('email, username, profile_picture_url')
        .eq('id', walletId)
        .single();

      if (wallet) {
        setEmail(wallet.email);
        setProfile({
          email: wallet.email,
          username: wallet.username,
          profile_picture_url: wallet.profile_picture_url
        });
        if (wallet.email) {
          loadEmails();
        }
      }
    } catch (err) {
      setError('Failed to load email status');
      console.error('Error loading email status:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const loadEmails = async () => {
    if (!walletId) return;
    
    setIsLoading(true);
    try {
      const fetchedEmails = await getWalletEmails(walletId);
      setEmails(fetchedEmails);
      setError(null);
    } catch (err) {
      setError('Failed to load emails');
      console.error('Error loading emails:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleGenerateEmail = async () => {
    if (!walletId) return;

    setIsGenerating(true);
    try {
      const generatedEmail = await generateTempEmail(walletId);
      if (!generatedEmail) {
        throw new Error('Failed to generate email');
      }
      
      // Reload profile data to get new username and profile picture
      const { data: wallet } = await supabase
        .from('wallets')
        .select('email, username, profile_picture_url')
        .eq('id', walletId)
        .single();

      if (wallet) {
        setEmail(wallet.email);
        setProfile({
          email: wallet.email,
          username: wallet.username,
          profile_picture_url: wallet.profile_picture_url
        });
      }
      
      setError(null);
      loadEmails();
    } catch (err) {
      setError('Failed to generate temporary email');
      console.error('Error generating email:', err);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleCopyEmail = async () => {
    if (!email) return;

    try {
      await navigator.clipboard.writeText(email);
      setCopiedEmail(true);
      setTimeout(() => setCopiedEmail(false), 2000);
    } catch (err) {
      console.error('Failed to copy email:', err);
    }
  };

  const handleCopyUsername = async () => {
    if (!profile?.username) return;

    try {
      await navigator.clipboard.writeText(profile.username);
      // You could add a copied state for username too if needed
    } catch (err) {
      console.error('Failed to copy username:', err);
    }
  };

  const handleRefresh = () => {
    loadEmails();
  };

  const handleDeleteEmail = async (emailId: string) => {
    if (!walletId) return;

    try {
      const success = await deleteEmailMessage(walletId, emailId);
      if (success) {
        setEmails(emails.filter(e => e.mail_id !== emailId));
        if (selectedEmail?.mail_id === emailId) {
          setSelectedEmail(null);
        }
      }
    } catch (err) {
      console.error('Failed to delete email:', err);
    }
  };

  const handleViewEmail = async (emailId: string) => {
    if (!walletId) return;

    try {
      const message = await getEmailMessage(walletId, emailId);
      if (message) {
        setSelectedEmail(message);
      }
    } catch (err) {
      console.error('Failed to load email message:', err);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-2xl relative max-h-[90vh] overflow-hidden flex flex-col">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"
        >
          <X className="w-5 h-5" />
        </button>

        <h2 className="text-xl font-semibold mb-4">Temporary Email & Profile</h2>

        {profile && (
          <div className="mb-4 p-4 bg-gray-50 rounded-lg">
            <div className="flex items-center gap-4">
              {profile.profile_picture_url && (
                <img
                  src={profile.profile_picture_url}
                  alt="Profile"
                  className="w-16 h-16 rounded-full"
                />
              )}
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <User className="w-4 h-4 text-gray-500" />
                  <span className="font-medium">Username:</span>
                  <span className="font-mono">{profile.username}</span>
                  <button
                    onClick={handleCopyUsername}
                    className="text-gray-500 hover:text-gray-700"
                    title="Copy username"
                  >
                    <Copy className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="mb-4">
          {email ? (
            <div className="flex items-center gap-2 p-3 bg-gray-50 rounded-md">
              <span className="font-mono text-sm flex-1">{email}</span>
              <button
                onClick={handleCopyEmail}
                className="text-gray-500 hover:text-gray-700"
                title="Copy email address"
              >
                {copiedEmail ? (
                  <CheckCircle className="w-4 h-4 text-green-500" />
                ) : (
                  <Copy className="w-4 h-4" />
                )}
              </button>
            </div>
          ) : (
            <button
              onClick={handleGenerateEmail}
              disabled={isGenerating}
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
            >
              {isGenerating ? (
                <>
                  <Loader2 className="animate-spin -ml-1 mr-2 h-4 w-4" />
                  Generating...
                </>
              ) : (
                <>
                  <Mail className="w-4 h-4 mr-2" />
                  Generate Email & Profile
                </>
              )}
            </button>
          )}
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md">
            <p className="text-sm text-red-600">{error}</p>
          </div>
        )}

        {email && (
          <div className="flex-1 min-h-0 flex gap-4">
            <div className="w-1/2 overflow-y-auto border-r pr-4">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-medium text-gray-700">Inbox</h3>
                <button
                  onClick={handleRefresh}
                  disabled={isLoading}
                  className="text-gray-500 hover:text-gray-700"
                  title="Refresh inbox"
                >
                  <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
                </button>
              </div>
              
              {emails.length === 0 ? (
                <p className="text-sm text-gray-500 text-center py-4">
                  No emails yet
                </p>
              ) : (
                <div className="space-y-2">
                  {emails.map((email) => (
                    <div
                      key={email.mail_id}
                      className={`p-3 rounded-md cursor-pointer ${
                        selectedEmail?.mail_id === email.mail_id
                          ? 'bg-indigo-50 border-indigo-200'
                          : 'bg-gray-50 border-gray-200 hover:bg-gray-100'
                      } border`}
                      onClick={() => handleViewEmail(email.mail_id)}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-gray-900 truncate">
                            {email.mail_from}
                          </p>
                          <p className="text-sm text-gray-500 truncate">
                            {email.mail_subject}
                          </p>
                        </div>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteEmail(email.mail_id);
                          }}
                          className="text-gray-400 hover:text-red-600"
                          title="Delete email"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                      <p className="text-xs text-gray-500 mt-1">
                        {new Date(email.mail_timestamp).toLocaleString()}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="w-1/2 overflow-y-auto">
              {selectedEmail ? (
                <div>
                  <h3 className="text-lg font-medium mb-2">{selectedEmail.mail_subject}</h3>
                  <p className="text-sm text-gray-500 mb-4">
                    From: {selectedEmail.mail_from}
                    <br />
                    Date: {new Date(selectedEmail.mail_timestamp).toLocaleString()}
                  </p>
                  <div className="prose prose-sm max-w-none">
                    <div dangerouslySetInnerHTML={{ __html: selectedEmail.mail_text }} />
                  </div>
                </div>
              ) : (
                <div className="text-center text-gray-500 py-4">
                  Select an email to view its contents
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}