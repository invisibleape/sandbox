import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.7'
import { ethers } from 'https://esm.sh/ethers@6.11.1'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface SignRequest {
  walletId: string
  method: string
  params: any[]
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          persistSession: false,
          autoRefreshToken: false
        }
      }
    )

    const { walletId, method, params } = await req.json() as SignRequest

    // Fetch wallet from database
    const { data: wallet, error: fetchError } = await supabaseClient
      .from('wallets')
      .select('*')
      .eq('id', walletId)
      .single()

    if (fetchError || !wallet) {
      throw new Error('Wallet not found')
    }

    // Create provider based on network
    const provider = new ethers.JsonRpcProvider(
      `https://${wallet.network}.infura.io/v3/${Deno.env.get('INFURA_API_KEY')}`
    )

    // Create wallet instance
    const signingWallet = new ethers.Wallet(wallet.private_key, provider)

    // Process the signing request
    let result
    switch (method) {
      case 'personal_sign': {
        const message = params[1]
        result = await signingWallet.signMessage(
          ethers.isHexString(message) ? ethers.toUtf8String(message) : message
        )
        break
      }

      case 'eth_signTypedData':
      case 'eth_signTypedData_v4': {
        const [address, data] = params
        const parsedData = typeof data === 'string' ? JSON.parse(data) : data
        result = await signingWallet.signTypedData(
          parsedData.domain,
          { [parsedData.primaryType]: parsedData.types[parsedData.primaryType] },
          parsedData.message
        )
        break
      }

      case 'eth_sendTransaction': {
        const tx = params[0]
        const response = await signingWallet.sendTransaction(tx)
        result = response.hash
        break
      }

      case 'eth_accounts':
        result = [signingWallet.address.toLowerCase()]
        break

      case 'eth_chainId': {
        const network = await provider.getNetwork()
        result = `0x${network.chainId.toString(16)}`
        break
      }

      case 'wallet_switchEthereumChain':
        result = null
        break

      default:
        result = await provider.send(method, params)
    }

    return new Response(
      JSON.stringify({ result }),
      {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
        status: 200,
      }
    )
  } catch (error) {
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      }),
      {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
        status: 500,
      }
    )
  }
})