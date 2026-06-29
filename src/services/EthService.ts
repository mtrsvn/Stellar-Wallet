import { ethers } from "ethers";
import { formatDateTime } from "../utils/formatDateTime";

const RPC_URL = "https://ethereum-sepolia-rpc.publicnode.com";
const ETHERSCAN_API = "https://eth-sepolia.blockscout.com/api";

export class EthService {
  private static provider = new ethers.JsonRpcProvider(RPC_URL);

  static async getBalance(address: string): Promise<string> {
    try {
      const balance = await this.provider.getBalance(address);
      const eth = ethers.formatEther(balance);
      return parseFloat(eth).toFixed(6) + " ETH";
    } catch {
      return "0.000000 ETH";
    }
  }

  static async sendTransaction(
    privateKey: string,
    toAddress: string,
    amountEth: string,
  ): Promise<{ success: boolean; hash?: string; error?: string }> {
    try {
      const wallet = new ethers.Wallet(privateKey, this.provider);
      const tx = await wallet.sendTransaction({
        to: toAddress,
        value: ethers.parseEther(amountEth),
      });
      return { success: true, hash: tx.hash };
    } catch (e: any) {
      return {
        success: false,
        error: e.reason || e.message || "Transaction failed",
      };
    }
  }

  static async getTransactions(address: string): Promise<any[]> {
    try {
      const url = `${ETHERSCAN_API}?module=account&action=txlist&address=${address}&startblock=0&endblock=99999999&page=1&offset=20&sort=desc`;
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
        const value = parseFloat(ethers.formatEther(tx.value || "0")).toFixed(
          3,
        );
        const txDate = new Date(parseInt(tx.timeStamp) * 1000);
        const date = txDate.toLocaleDateString();
        const dateTime = formatDateTime(txDate);

        const shortFrom = tx.from
          ? `${tx.from.substring(0, 4)}...${tx.from.substring(tx.from.length - 4)}`
          : "";
        const shortTo = tx.to
          ? `${tx.to.substring(0, 4)}...${tx.to.substring(tx.to.length - 4)}`
          : "";
        const subtitle = `${value} ETH ${isIncoming ? "from" : "to"} ${isIncoming ? shortFrom : shortTo}`;

        return {
          title: isIncoming ? "Received ETH" : "Sent ETH",
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
