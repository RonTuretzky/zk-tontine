import { createWalletClient, createPublicClient, http } from "viem"
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts"
import { gnosis } from "viem/chains"

/* A built-in throwaway wallet for demos and recordings, enabled with
   ?wallet=demo (persists in this browser). It generates a fresh key on first
   use, keeps it in localStorage, and signs locally — every transaction is a
   real Gnosis transaction from a burner account, no extension needed. */

const KEY_STORAGE = "long-bread-demo-key"
const FLAG_STORAGE = "long-bread-demo-wallet"
const RPC = "https://rpc.gnosischain.com"

export function demoWalletEnabled(): boolean {
  if (typeof window === "undefined") return false
  const params = new URLSearchParams(window.location.search)
  if (params.get("wallet") === "demo") {
    window.localStorage.setItem(FLAG_STORAGE, "1")
    return true
  }
  return window.localStorage.getItem(FLAG_STORAGE) === "1"
}

function demoKey(): `0x${string}` {
  let k = window.localStorage.getItem(KEY_STORAGE) as `0x${string}` | null
  if (!k) {
    k = generatePrivateKey()
    window.localStorage.setItem(KEY_STORAGE, k)
  }
  return k
}

// Minimal EIP-1193 provider over a local viem account. Enough surface for
// wagmi's injected connector: accounts, chain id, sends, signatures.
export function makeDemoProvider() {
  const account = privateKeyToAccount(demoKey())
  const wallet = createWalletClient({ account, chain: gnosis, transport: http(RPC) })
  const reader = createPublicClient({ chain: gnosis, transport: http(RPC) })

  const provider = {
    on: () => {},
    removeListener: () => {},
    async request({ method, params }: { method: string; params?: unknown[] }) {
      switch (method) {
        case "eth_accounts":
        case "eth_requestAccounts":
          return [account.address]
        case "eth_chainId":
          return "0x64" // gnosis
        case "wallet_switchEthereumChain":
        case "wallet_addEthereumChain":
          return null
        case "eth_sendTransaction": {
          const tx = (params as [Record<string, unknown>])[0]
          return wallet.sendTransaction({
            to: tx.to as `0x${string}`,
            data: (tx.data ?? undefined) as `0x${string}` | undefined,
            value: tx.value ? BigInt(tx.value as string) : undefined,
            gas: tx.gas ? BigInt(tx.gas as string) : undefined,
            account,
            chain: gnosis,
          })
        }
        case "personal_sign": {
          const [message, addr] = params as [`0x${string}`, `0x${string}`]
          void addr
          return wallet.signMessage({ account, message: { raw: message } })
        }
        case "eth_signTypedData_v4": {
          const [, typed] = params as [`0x${string}`, string]
          return account.signTypedData(JSON.parse(typed))
        }
        default:
          // Reads fall through to the public RPC.
          return reader.request({ method, params } as never)
      }
    },
  }
  return provider
}
