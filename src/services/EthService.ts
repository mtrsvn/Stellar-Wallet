import { ethers } from "ethers";
import { formatDateTime } from "../utils/formatDateTime";
import { Network } from "../utils/networks";

export class EthService {
  private static providers: Record<string, ethers.JsonRpcProvider> = {};

  private static getProvider(rpcUrl: string) {
    if (!this.providers[rpcUrl]) {
      this.providers[rpcUrl] = new ethers.JsonRpcProvider(rpcUrl);
    }
    return this.providers[rpcUrl];
  }

  static async getBalance(address: string, network: Network): Promise<string> {
    try {
      const provider = this.getProvider(network.rpcUrl);
      const balance = await provider.getBalance(address);
      const formatted = ethers.formatEther(balance);
      return parseFloat(formatted).toFixed(6) + " " + network.symbol;
    } catch {
      return "0.000000 " + network.symbol;
    }
  }

  static async getTokenBalance(address: string, tokenAddress: string, decimals: number, network: Network): Promise<string> {
    try {
      const provider = this.getProvider(network.rpcUrl);
      const abi = ["function balanceOf(address owner) view returns (uint256)"];
      const contract = new ethers.Contract(tokenAddress, abi, provider);
      const balance = await contract.balanceOf(address);
      const formatted = ethers.formatUnits(balance, decimals);
      return parseFloat(formatted).toFixed(6);
    } catch {
      return "0.000000";
    }
  }

  static async getTokenMetadata(tokenAddress: string, network: Network): Promise<{ name: string; symbol: string; decimals: number }> {
    const provider = this.getProvider(network.rpcUrl);
    const abi = [
      "function name() view returns (string)",
      "function symbol() view returns (string)",
      "function decimals() view returns (uint8)",
    ];
    const contract = new ethers.Contract(tokenAddress, abi, provider);
    const [name, symbol, decimals] = await Promise.all([
      contract.name().catch(() => "Custom Token"),
      contract.symbol(),
      contract.decimals(),
    ]);

    return {
      name: String(name || "Custom Token"),
      symbol: String(symbol || "TOKEN"),
      decimals: Number(decimals),
    };
  }

  private static getExplorerApiUrl(network: Network) {
    if (network.id === "ethereum-sepolia") return "https://eth-sepolia.blockscout.com/api";
    if (network.id === "ethereum-mainnet") return "https://api.etherscan.io/api";
    if (network.id === "bnb-mainnet") return "https://api.bscscan.com/api";
    if (network.id === "bnb-testnet") return "https://api-testnet.bscscan.com/api";
    return "";
  }

  static async discoverTokens(address: string, network: Network): Promise<Array<{
    address: string;
    name: string;
    symbol: string;
    decimals: number;
  }>> {
    const tokens = new Map<string, { address: string; name: string; symbol: string; decimals: number }>();
    if (!address) return [];

    try {
      const apiUrl = this.getExplorerApiUrl(network);
      if (apiUrl) {
        const tokenUrl = `${apiUrl}?module=account&action=tokentx&address=${address}&startblock=0&endblock=99999999&page=1&offset=100&sort=desc`;
        const res = await fetch(tokenUrl).catch(() => null);
        if (res?.ok) {
          const data = await res.json();
          if (Array.isArray(data.result)) {
            for (const tx of data.result) {
              if (tokens.size >= 25) break;
              const tokenAddress = String(tx.contractAddress || "");
              if (!ethers.isAddress(tokenAddress)) continue;

              const decimals = parseInt(tx.tokenDecimal || "18", 10);
              tokens.set(tokenAddress.toLowerCase(), {
                address: tokenAddress,
                name: String(tx.tokenName || tx.tokenSymbol || "Token"),
                symbol: String(tx.tokenSymbol || "TOKEN"),
                decimals: Number.isFinite(decimals) ? decimals : 18,
              });
            }
          }
        }
      }

      const logTokenAddresses = await this.discoverRecentReceivedTokenContracts(address, network);
      for (const tokenAddress of logTokenAddresses) {
        if (tokens.size >= 25) break;
        const key = tokenAddress.toLowerCase();
        if (tokens.has(key)) continue;

        try {
          const metadata = await this.getTokenMetadata(tokenAddress, network);
          tokens.set(key, {
            address: tokenAddress,
            name: metadata.name,
            symbol: metadata.symbol,
            decimals: metadata.decimals,
          });
        } catch {}
      }
    } catch {
      // Keep any tokens found before an explorer/RPC failure.
    }

    return Array.from(tokens.values());
  }

  private static async discoverRecentReceivedTokenContracts(address: string, network: Network): Promise<string[]> {
    try {
      const provider = this.getProvider(network.rpcUrl);
      const latestBlock = await provider.getBlockNumber();
      const oldestBlock = Math.max(0, latestBlock - 100000);
      const chunkSize = 5000;
      const transferTopic = ethers.id("Transfer(address,address,uint256)");
      const paddedRecipient = ethers.zeroPadValue(address, 32);
      const ranges: Array<{ fromBlock: number; toBlock: number }> = [];

      for (let toBlock = latestBlock; toBlock >= oldestBlock; toBlock -= chunkSize) {
        ranges.push({
          fromBlock: Math.max(oldestBlock, toBlock - chunkSize + 1),
          toBlock,
        });
        if (ranges.length >= 20) break;
      }

      const results = await Promise.allSettled(
        ranges.map(range =>
          provider.getLogs({
            ...range,
            topics: [transferTopic, null, paddedRecipient],
          })
        )
      );

      const tokenContracts = new Set<string>();
      results.forEach(result => {
        if (result.status !== 'fulfilled') return;
        result.value.forEach(log => tokenContracts.add(log.address));
      });

      return Array.from(tokenContracts).slice(0, 25);
    } catch {
      return [];
    }
  }

  static async sendTransaction(
    privateKey: string,
    toAddress: string,
    amountStr: string,
    network: Network,
    tokenAddress?: string,
    decimals?: number
  ): Promise<{ success: boolean; hash?: string; error?: string }> {
    try {
      const provider = this.getProvider(network.rpcUrl);
      const wallet = new ethers.Wallet(privateKey, provider);
      
      if (tokenAddress && decimals !== undefined) {
         const abi = ["function transfer(address to, uint256 value) returns (bool)"];
         const contract = new ethers.Contract(tokenAddress, abi, wallet);
         const amount = ethers.parseUnits(amountStr, decimals);
         const tx = await contract.transfer(toAddress, amount);
         return { success: true, hash: tx.hash };
      } else {
         const tx = await wallet.sendTransaction({
           to: toAddress,
           value: ethers.parseEther(amountStr),
         });
         return { success: true, hash: tx.hash };
      }
    } catch (e: any) {
      return {
        success: false,
        error: e.reason || e.message || "Transaction failed",
      };
    }
  }

  static async getTransactionStatus(
    hash: string,
    network: Network
  ): Promise<"pending" | "confirmed" | "failed"> {
    try {
      const provider = this.getProvider(network.rpcUrl);
      const receipt = await provider.getTransactionReceipt(hash);
      if (!receipt) return "pending";
      return receipt.status === 1 ? "confirmed" : "failed";
    } catch {
      return "pending";
    }
  }

  static async getTransactions(address: string, network: Network): Promise<any[]> {
    try {
      const apiUrl = this.getExplorerApiUrl(network);
      if (!apiUrl) return [];

      const txUrl = `${apiUrl}?module=account&action=txlist&address=${address}&startblock=0&endblock=99999999&page=1&offset=20&sort=desc`;
      const tokenUrl = `${apiUrl}?module=account&action=tokentx&address=${address}&startblock=0&endblock=99999999&page=1&offset=20&sort=desc`;
      
      const [txRes, tokenRes] = await Promise.all([
        fetch(txUrl).catch(() => null),
        fetch(tokenUrl).catch(() => null)
      ]);

      let allTxs: any[] = [];

      if (txRes && txRes.ok) {
        const txData = await txRes.json();
        if (txData.status === "1" && Array.isArray(txData.result)) {
          allTxs = [...allTxs, ...txData.result];
        }
      }

      if (tokenRes && tokenRes.ok) {
        const tokenData = await tokenRes.json();
        if (tokenData.status === "1" && Array.isArray(tokenData.result)) {
          allTxs = [...allTxs, ...tokenData.result];
        }
      }

      // Deduplicate by hash (if a normal tx is also a token tx, keep the token tx to show the token amount)
      const uniqueTxs = new Map();
      for (const tx of allTxs) {
        // If it has tokenSymbol, it's a token transfer. We prefer this over the normal tx.
        if (tx.tokenSymbol || !uniqueTxs.has(tx.hash)) {
          uniqueTxs.set(tx.hash, tx);
        }
      }

      let txs = Array.from(uniqueTxs.values());
      txs.sort((a: any, b: any) => parseInt(b.timeStamp || "0") - parseInt(a.timeStamp || "0"));

      return txs.slice(0, 20).map((tx: any) => {
        const isIncoming = tx.to?.toLowerCase() === address.toLowerCase();
        
        let valueStr = "0";
        let symbol = network.symbol;
        if (tx.tokenSymbol) {
          const decimals = parseInt(tx.tokenDecimal || "18");
          valueStr = ethers.formatUnits(tx.value || "0", decimals);
          symbol = tx.tokenSymbol;
        } else {
          valueStr = ethers.formatEther(tx.value || "0");
        }
        
        const value = parseFloat(valueStr).toFixed(3);
        const txDate = new Date(parseInt(tx.timeStamp) * 1000);
        const date = txDate.toLocaleDateString();
        const dateTime = formatDateTime(txDate);

        const shortFrom = tx.from
          ? `${tx.from.substring(0, 4)}...${tx.from.substring(tx.from.length - 4)}`
          : "";
        const shortTo = tx.to
          ? `${tx.to.substring(0, 4)}...${tx.to.substring(tx.to.length - 4)}`
          : "";
        
        let actionStr = isIncoming ? "Received" : "Sent";
        // If value is 0 and it's a normal tx, it might be a contract interaction (like an approval or failed transfer)
        if (parseFloat(value) === 0 && !tx.tokenSymbol) {
           actionStr = "Contract Call";
        }
        
        const subtitle = `${value} ${symbol} ${isIncoming ? "from" : "to"} ${isIncoming ? shortFrom : shortTo}`;

        return {
          title: `${actionStr} ${symbol}`,
          subtitle,
          amount: `${isIncoming ? "+" : "-"}${value} ${symbol}`,
          delta: isIncoming ? "+" : "-",
          amountColor: isIncoming ? "#14F195" : "white",
          date,
          dateTime: txDate.toISOString(),
          icon: actionStr === "Contract Call" ? "HelpCircle" : isIncoming ? "ArrowDownLeft" : "ArrowUpRight",
          from: tx.from || "",
          to: tx.to || "",
          hash: tx.hash,
        };
      });
    } catch (e) {
      return [];
    }
  }
}
