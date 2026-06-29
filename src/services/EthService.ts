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

      const url = `${apiUrl}?module=account&action=txlist&address=${address}&startblock=0&endblock=99999999&page=1&offset=20&sort=desc`;
      const response = await fetch(url);
      const data = await response.json();
      if (data.status !== "1") return [];

      let txs = data.result;
      if (Array.isArray(txs)) {
        txs.sort(
          (a: any, b: any) =>
            parseInt(b.timeStamp || "0") - parseInt(a.timeStamp || "0"),
        );
      } else {
        txs = [];
      }

      return txs.map((tx: any) => {
        const isIncoming = tx.to?.toLowerCase() === address.toLowerCase();
        const value = parseFloat(ethers.formatEther(tx.value || "0")).toFixed(3);
        const txDate = new Date(parseInt(tx.timeStamp) * 1000);
        const date = txDate.toLocaleDateString();
        const dateTime = formatDateTime(txDate);

        const shortFrom = tx.from
          ? `${tx.from.substring(0, 4)}...${tx.from.substring(tx.from.length - 4)}`
          : "";
        const shortTo = tx.to
          ? `${tx.to.substring(0, 4)}...${tx.to.substring(tx.to.length - 4)}`
          : "";
        const subtitle = `${value} ${network.symbol} ${isIncoming ? "from" : "to"} ${isIncoming ? shortFrom : shortTo}`;

        return {
          title: isIncoming ? `Received ${network.symbol}` : `Sent ${network.symbol}`,
          subtitle,
          date,
          dateTime,
          icon: isIncoming ? "ArrowDownLeft" : "ArrowUpRight",
        };
      });
    } catch {
      return [];
    }
  }
}
