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
      
      if (tokenAddress && decimals) {
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

  static async getTransactions(address: string, network: Network): Promise<any[]> {
    try {
      // Very basic URL deduction. In production, define an explicit `apiUrl` on the Network interface.
      let apiUrl = "";
      if (network.id === "ethereum-sepolia") {
        apiUrl = "https://eth-sepolia.blockscout.com/api";
      } else if (network.id === "ethereum-mainnet") {
        apiUrl = "https://api.etherscan.io/api";
      } else if (network.id === "polygon-mainnet") {
        apiUrl = "https://api.polygonscan.com/api";
      } else if (network.id === "polygon-amoy") {
        apiUrl = "https://api-amoy.polygonscan.com/api";
      } else if (network.id === "bnb-mainnet") {
        apiUrl = "https://api.bscscan.com/api";
      } else if (network.id === "bnb-testnet") {
        apiUrl = "https://api-testnet.bscscan.com/api";
      } else {
        return [];
      }

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
          date,
          dateTime: txDate.toISOString(),
          icon: actionStr === "Contract Call" ? "HelpCircle" : isIncoming ? "ArrowDownLeft" : "ArrowUpRight",
        };
      });
    } catch (e) {
      return [];
    }
  }
}
