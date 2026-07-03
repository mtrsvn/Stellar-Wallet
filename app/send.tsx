import React, { useEffect, useMemo, useState } from "react";
import {
    Alert,
    Image,
    Linking,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    View
} from "react-native";
import { HapticTouchableOpacity } from "../src/components/HapticTouchableOpacity";

import { FontAwesome } from "@expo/vector-icons";
import Slider from "@react-native-community/slider";
import { ethers } from "ethers";
import { useLocalSearchParams, useRouter } from "expo-router";
import { BookOpen, CheckCircle2, ChevronDown, ChevronRight, Clock3, ExternalLink, Plus, Trash2, XCircle } from "lucide-react-native";
import {
    SafeAreaView
} from "react-native-safe-area-context";
import {
    BottomSheet,
    handleStyle,
    sheetBaseStyle,
} from "../src/components/BottomSheet";
import { GradientButton } from "../src/components/GradientButton";
import { getNetworkIcon } from "../src/components/NetworkIcons";
import { PinEntryScreen } from "../src/components/PinEntryScreen";
import { AddressBookEntry, TokenBalance, useWallet } from "../src/context/WalletContext";
import { BtcService } from "../src/services/BtcService";
import { EthService } from "../src/services/EthService";
import { SolService } from "../src/services/SolService";
import { WalletCore } from "../src/utils/WalletCore";
import { getNetworksByMode } from "../src/utils/networks";

type SendStatus = "idle" | "pending" | "confirmed" | "failed";
type GasEstimate = {
  feeEth: string;
  gasLimit: string;
  gasPriceGwei: string;
};

const getExplorerTxUrl = (asset: TokenBalance | undefined, hash: string) => {
  if (!asset || !hash) return "";
  const network = asset.network;
  if (network.type === "SOL") {
    if (network.id === "solana-devnet") {
      return `https://explorer.solana.com/tx/${hash}?cluster=devnet`;
    }
    return `https://solscan.io/tx/${hash}`;
  }
  return `${network.explorerUrl.replace(/\/$/, "")}/tx/${hash}`;
};

export default function SendScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const wallet = useWallet();
  const [address, setAddress] = useState((params.to as string) || "");
  const [amount, setAmount] = useState((params.amount as string) || "");
  const [isSending, setIsSending] = useState(false);
  const [selectedAssetId, setSelectedAssetId] = useState(
    (params.assetId as string) || "",
  );
  const [showPin, setShowPin] = useState(false);
  const [showNetworkSheet, setShowNetworkSheet] = useState(false);
  const [showTokenSheet, setShowTokenSheet] = useState(false);
  const [showAddressBookSheet, setShowAddressBookSheet] = useState(false);
  const [showReviewSheet, setShowReviewSheet] = useState(false);
  const [sendStatus, setSendStatus] = useState<SendStatus>("idle");
  const [sendHash, setSendHash] = useState("");
  const [sendError, setSendError] = useState("");
  const [amountPercent, setAmountPercent] = useState(0);
  const [gasEstimate, setGasEstimate] = useState<GasEstimate | null>(null);
  const [isEstimatingGas, setIsEstimatingGas] = useState(false);
  const [contactName, setContactName] = useState("");

  const selectableNetworks = getNetworksByMode(wallet.isTestnet);
  const nativeNetworkAssets: TokenBalance[] = selectableNetworks.map((network) => {
    const existing = wallet.tokenBalances?.find((tb) => tb.isNative && tb.network.id === network.id);
    if (existing) return existing;

    return {
      id: network.id,
      isNative: true,
      network,
      balanceStr: `0.000000 ${network.symbol}`,
      balanceValue: 0,
      usdValue: 0,
    };
  });
  const nonNativeAssets = (wallet.tokenBalances || []).filter((tb) => !tb.isNative);
  const allAssets = [...nativeNetworkAssets, ...nonNativeAssets];

  const selectedAsset = allAssets.find(
    (t) => t.id === selectedAssetId,
  );
  const cleanAmount = amount.replace(",", ".").trim();
  const assetSymbol = selectedAsset?.isNative
    ? selectedAsset.network.symbol
    : selectedAsset?.token?.symbol || "Token";
  const estimatedUsdValue = useMemo(() => {
    const amountNumber = Number(cleanAmount);
    if (!selectedAsset || !Number.isFinite(amountNumber) || amountNumber <= 0) return 0;
    const unitPrice = selectedAsset.balanceValue > 0
      ? selectedAsset.usdValue / selectedAsset.balanceValue
      : 0;
    return amountNumber * unitPrice;
  }, [cleanAmount, selectedAsset]);
  const explorerTxUrl = getExplorerTxUrl(selectedAsset, sendHash);
  const availableBalance = selectedAsset?.balanceValue || 0;
  const gasFeeValue = Number(gasEstimate?.feeEth || 0);
  const gasFeeText = gasEstimate
    ? `${formatAmountInput(gasFeeValue)} ${selectedAsset?.network.symbol || ""}`
    : "Calculating...";
  const addressBookEntries = wallet.addressBook.filter(
    (entry) => entry.networkType === (selectedAsset?.network.type || "EVM"),
  );

  const formatAmountInput = (value: number) => {
    if (!Number.isFinite(value) || value <= 0) return "";
    return value.toFixed(8).replace(/\.?0+$/, "");
  };

  const setAmountByPercent = (percent: number) => {
    const safePercent = Math.max(0, Math.min(100, Math.round(percent)));
    setAmountPercent(safePercent);
    const spendableBalance = selectedAsset?.isNative
      ? Math.max(availableBalance - gasFeeValue, 0)
      : availableBalance;
    setAmount(formatAmountInput((spendableBalance * safePercent) / 100));
  };

  const handleAmountChange = (value: string) => {
    setAmount(value);
    const parsed = Number(value.replace(",", "."));
    if (!availableBalance || !Number.isFinite(parsed) || parsed <= 0) {
      setAmountPercent(0);
      return;
    }
    setAmountPercent(Math.max(0, Math.min(100, Math.round((parsed / availableBalance) * 100))));
  };

  useEffect(() => {
    if (!sendHash || sendStatus !== "pending" || selectedAsset?.network.type !== "EVM") return;

    let cancelled = false;
    let retryTimeout: ReturnType<typeof setTimeout> | undefined;
    let attempts = 0;
    const poll = async () => {
      attempts += 1;
      const nextStatus = await EthService.getTransactionStatus(sendHash, selectedAsset.network);
      if (cancelled) return;
      if (nextStatus !== "pending") {
        setSendStatus(nextStatus);
        wallet.updateTransactionStatus(sendHash, nextStatus);
        wallet.refreshData();
        return;
      }
      if (attempts < 30) {
        retryTimeout = setTimeout(poll, 5000);
      }
    };

    const timeout = setTimeout(poll, 3000);
    return () => {
      cancelled = true;
      clearTimeout(timeout);
      if (retryTimeout) clearTimeout(retryTimeout);
    };
  }, [sendHash, sendStatus, selectedAsset?.network.id]);

  const handleMax = () => {
    if (
      selectedAsset &&
      selectedAsset.balanceStr !== "0" &&
      selectedAsset.balanceStr !== "0.000000"
    ) {
      const spendableBalance = selectedAsset.isNative
        ? Math.max(selectedAsset.balanceValue - gasFeeValue, 0)
        : selectedAsset.balanceValue;
      setAmount(formatAmountInput(spendableBalance));
      setAmountPercent(100);
    }
  };

  const saveCurrentAddress = async () => {
    const cleanAddress = address.trim();
    if (!selectedAsset || !ethers.isAddress(cleanAddress)) {
      Alert.alert("Error", "Enter a valid EVM address first.");
      return;
    }
    const defaultName = `${cleanAddress.slice(0, 6)}...${cleanAddress.slice(-4)}`;
    await wallet.saveAddressBookEntry({
      name: contactName.trim() || defaultName,
      address: cleanAddress,
      networkType: selectedAsset.network.type,
    });
    setContactName("");
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };

  const selectAddressBookEntry = (entry: AddressBookEntry) => {
    setAddress(entry.address);
    setContactName(entry.name);
    setShowAddressBookSheet(false);
  };

  const validateAndPromptPin = async () => {
    const cleanAddress = address.trim();
    setGasEstimate(null);
    if (!cleanAddress || !cleanAmount || !selectedAsset) {
      Alert.alert(
        "Error",
        "Please enter address, amount, and select an asset.",
      );
      return;
    }
    if (isNaN(Number(cleanAmount)) || Number(cleanAmount) <= 0) {
      Alert.alert("Error", "Invalid amount.");
      return;
    }
    if (selectedAsset.network.type !== "EVM") {
      Alert.alert(
        "Not Implemented",
        `Sending on ${selectedAsset.network.name} is not fully supported in this beta yet.`,
      );
      return;
    }
    if (!ethers.isAddress(cleanAddress)) {
      Alert.alert("Error", "Invalid EVM recipient address.");
      return;
    }

    if (Number(cleanAmount) > selectedAsset.balanceValue) {
      Alert.alert("Error", "Amount is higher than your available balance.");
      return;
    }

    setIsEstimatingGas(true);
    try {
      const estimate = await EthService.estimateTransactionFee(
        wallet.evmAddress,
        cleanAddress,
        cleanAmount,
        selectedAsset.network,
        !selectedAsset.isNative ? selectedAsset.token?.address : undefined,
        !selectedAsset.isNative ? selectedAsset.token?.decimals : undefined,
      );
      setGasEstimate(estimate);

      if (selectedAsset.isNative && Number(cleanAmount) + Number(estimate.feeEth) > selectedAsset.balanceValue) {
        Alert.alert("Insufficient Balance", "You need to leave enough native balance for the network fee.");
        return;
      }
    } catch (e: any) {
      Alert.alert("Gas Estimate Failed", e.reason || e.message || "Unable to estimate network fee.");
      return;
    } finally {
      setIsEstimatingGas(false);
    }

    setShowReviewSheet(true);
  };

  const executeSend = async () => {
    const cleanAddress = address.trim();
    setIsSending(true);
    setSendError("");
    setSendStatus("pending");
    try {
      const activeWallet = wallet.savedWallets.find(
        (w) => w.id === wallet.activeWalletId,
      );
      if (!activeWallet?.mnemonic) {
        throw new Error("No active wallet found.");
      }

      let result;
      if (selectedAsset!.network.type === "EVM") {
        const privateKey = WalletCore.getEvmPrivateKey(
          activeWallet.mnemonic,
          0,
        );
        result = await EthService.sendTransaction(
          privateKey,
          cleanAddress,
          cleanAmount,
          selectedAsset!.network,
          !selectedAsset!.isNative ? selectedAsset!.token?.address : undefined,
          !selectedAsset!.isNative ? selectedAsset!.token?.decimals : undefined,
        );
      } else if (selectedAsset!.network.type === "SOL") {
        const privateKey = WalletCore.getSolanaPrivateKey(
          activeWallet.mnemonic,
          0,
        );
        result = await SolService.sendTransaction(
          privateKey,
          cleanAddress,
          cleanAmount,
          selectedAsset!.network,
        );
      } else if (selectedAsset!.network.type === "BTC") {
        const privateKey = WalletCore.getBtcPrivateKey(
          activeWallet.mnemonic,
          0,
        );
        result = await BtcService.sendTransaction(
          privateKey,
          cleanAddress,
          cleanAmount,
          selectedAsset!.network,
        );
      } else {
        throw new Error("Unsupported network type");
      }

      if (result.success) {
        const hash = result.hash || "";
        setSendHash(hash);
        wallet.addLocalTransaction({
          title: `Sent ${assetSymbol}`,
          subtitle: `${cleanAmount} ${assetSymbol} to ${cleanAddress.slice(0, 6)}...${cleanAddress.slice(-4)}`,
          amount: `-${cleanAmount} ${assetSymbol}`,
          delta: "-",
          amountColor: "white",
          icon: "ArrowUpRight",
          from: wallet.evmAddress,
          to: cleanAddress,
          networkId: selectedAsset!.network.id,
          hash,
          status: selectedAsset!.network.type === "EVM" ? "pending" : "confirmed",
          date: new Date().toLocaleDateString(),
          dateTime: new Date().toISOString(),
        });
        if (selectedAsset!.network.type !== "EVM") {
          setSendStatus("confirmed");
          if (hash) wallet.updateTransactionStatus(hash, "confirmed");
          wallet.refreshData();
        }
      } else {
        setSendStatus("failed");
        setSendError(result.error || "Transaction failed.");
      }
    } catch (e: any) {
      setSendStatus("failed");
      setSendError(e.message || "Failed to send");
    } finally {
      setIsSending(false);
    }
  };

  if (showPin) {
    return (
      <PinEntryScreen
        onUnlock={() => {
          setShowPin(false);
          // Wait for PIN screen to unmount before showing loading/alert
          setTimeout(() => executeSend(), 100);
        }}
        onLogout={() => {
          setShowPin(false);
        }}
        forRemoval={false}
      />
    );
  }

  if (sendStatus !== "idle") {
    const StatusIcon =
      sendStatus === "confirmed" ? CheckCircle2 : sendStatus === "failed" ? XCircle : Clock3;
    const statusColor =
      sendStatus === "confirmed" ? "#14F195" : sendStatus === "failed" ? "#FF5A5F" : "#F3BA2F";
    const statusTitle =
      sendStatus === "confirmed"
        ? "Transaction Confirmed"
        : sendStatus === "failed"
          ? "Transaction Failed"
          : "Transaction Pending";

    return (
      <SafeAreaView style={styles.container} edges={["top", "left", "right"]}>
        <View style={styles.statusScreen}>
          <View style={[styles.statusIconBox, { backgroundColor: `${statusColor}22` }]}>
            <StatusIcon size={42} color={statusColor} />
          </View>
          <Text style={styles.statusTitle}>{statusTitle}</Text>
          <Text style={styles.statusSubtitle}>
            {sendStatus === "pending"
              ? "Your transaction was submitted. Waiting for network confirmation."
              : sendStatus === "confirmed"
                ? "Your transaction is confirmed on-chain."
                : sendError || "The network rejected this transaction."}
          </Text>

          <View style={styles.reviewCard}>
            <View style={styles.reviewRow}>
              <Text style={styles.reviewLabel}>Asset</Text>
              <Text style={styles.reviewValue}>{assetSymbol}</Text>
            </View>
            <View style={styles.reviewRow}>
              <Text style={styles.reviewLabel}>Amount</Text>
              <Text style={styles.reviewValue}>{cleanAmount} {assetSymbol}</Text>
            </View>
            <View style={styles.reviewRow}>
              <Text style={styles.reviewLabel}>Network</Text>
              <Text style={styles.reviewValue}>{selectedAsset?.network.name || "Unknown"}</Text>
            </View>
            <View style={[styles.reviewRow, styles.reviewRowLast]}>
              <Text style={styles.reviewLabel}>Hash</Text>
              <Text style={styles.reviewValue} numberOfLines={1} ellipsizeMode="middle">
                {sendHash || "Not available"}
              </Text>
            </View>
          </View>

          <HapticTouchableOpacity
            style={[styles.primaryAction, !explorerTxUrl && styles.primaryActionDisabled]}
            disabled={!explorerTxUrl}
            onPress={() => Linking.openURL(explorerTxUrl)}
          >
            <ExternalLink size={18} color={explorerTxUrl ? "white" : "rgba(255,255,255,0.35)"} />
            <Text style={[styles.primaryActionText, !explorerTxUrl && styles.primaryActionTextDisabled]}>
              View on Explorer
            </Text>
          </HapticTouchableOpacity>

          <HapticTouchableOpacity
            style={styles.secondaryAction}
            onPress={() => {
              wallet.refreshData();
              router.replace("/(tabs)" as any);
            }}
          >
            <Text style={styles.secondaryActionText}>Back to Wallet</Text>
          </HapticTouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={["top", "left", "right"]}>
      <ScrollView style={styles.content}>
        <View style={styles.header}>
          <HapticTouchableOpacity
            onPress={() => router.back()}
            style={{ width: 40, height: 40, justifyContent: "center" }}
          >
            <FontAwesome name="chevron-left" size={20} color="white" />
          </HapticTouchableOpacity>
          <Text style={styles.headerTitle}>Send Crypto</Text>
          <View style={{ width: 40 }} />
        </View>

        <View style={styles.form}>
          <Text style={styles.label}>Network</Text>
          <HapticTouchableOpacity
            onPress={() => setShowNetworkSheet(true)}
            style={styles.inputContainer}
          >
            {selectedAsset ? (
              <View style={styles.assetSelectContent}>
                <View style={styles.assetSelectLeft}>
                  <View
                    style={{
                      marginRight: 12,
                      width: 32,
                      height: 32,
                      borderRadius: 16,
                      overflow: "hidden",
                    }}
                  >
                    {getNetworkIcon(selectedAsset.network.symbol, 32)}
                  </View>
                  <View>
                    <Text style={styles.assetSelectTitle}>
                      {selectedAsset.isNative
                        ? selectedAsset.network.name
                        : selectedAsset.token?.symbol || "Token"}
                    </Text>
                    <Text style={styles.assetSelectSubtitle}>
                      {selectedAsset.network.name} Network
                    </Text>
                  </View>
                </View>
                <ChevronDown color="rgba(255,255,255,0.3)" size={20} />
              </View>
            ) : (
              <View style={styles.assetSelectContent}>
                <Text style={styles.assetSelectPlaceholder}>
                  Select a network...
                </Text>
                <ChevronDown color="rgba(255,255,255,0.3)" size={20} />
              </View>
            )}
          </HapticTouchableOpacity>

          <View style={{ height: 24 }} />

          <Text style={styles.label}>Asset</Text>
          <HapticTouchableOpacity
            onPress={() => setShowTokenSheet(true)}
            style={styles.inputContainer}
          >
            {selectedAsset ? (
              <View style={styles.assetSelectContent}>
                <View style={styles.assetSelectLeft}>
                  <View
                    style={{
                      marginRight: 12,
                      width: 32,
                      height: 32,
                      borderRadius: 16,
                      overflow: "hidden",
                    }}
                  >
                    {selectedAsset.isNative ? (
                      getNetworkIcon(selectedAsset.network.symbol, 32)
                    ) : selectedAsset.token?.logoUrl ? (
                      <Image
                        source={{ uri: selectedAsset.token.logoUrl }}
                        style={{ width: 32, height: 32, borderRadius: 16 }}
                      />
                    ) : (
                      <View
                        style={{
                          width: 32,
                          height: 32,
                          backgroundColor: "#333",
                          borderRadius: 16,
                        }}
                      />
                    )}
                  </View>
                  <View>
                    <Text style={styles.assetSelectTitle}>
                      {selectedAsset.isNative
                        ? selectedAsset.network.symbol
                        : selectedAsset.token?.symbol || "Token"}
                    </Text>
                    <Text style={styles.assetSelectSubtitle}>
                      Balance: {selectedAsset.balanceStr}
                    </Text>
                  </View>
                </View>
                <ChevronDown color="rgba(255,255,255,0.3)" size={20} />
              </View>
            ) : (
              <View style={styles.assetSelectContent}>
                <Text style={styles.assetSelectPlaceholder}>
                  Select an asset...
                </Text>
                <ChevronDown color="rgba(255,255,255,0.3)" size={20} />
              </View>
            )}
          </HapticTouchableOpacity>

          <View style={{ height: 24 }} />

          <Text style={styles.label}>Recipient Address</Text>
          <View style={styles.inputContainer}>
            <TextInput
              style={styles.input}
              placeholder={
                selectedAsset?.network.type === "EVM" ? "0x..." : "Address..."
              }
              placeholderTextColor="rgba(255,255,255,0.3)"
              value={address}
              onChangeText={setAddress}
              autoCapitalize="none"
              autoCorrect={false}
            />
            <HapticTouchableOpacity
              onPress={() =>
                router.push({
                  pathname: "/scan",
                  params: {
                    returnTo: "/send",
                    assetId: selectedAssetId,
                    amount: amount,
                  },
                })
              }
              style={{ padding: 8 }}
            >
              <FontAwesome
                name="qrcode"
                size={24}
                color="rgba(255,255,255,0.7)"
              />
            </HapticTouchableOpacity>
          </View>

          <View style={{ height: 24 }} />

          <View
            style={{
              flexDirection: "row",
              justifyContent: "space-between",
              alignItems: "flex-end",
              marginBottom: 8,
            }}
          >
            <Text style={[styles.label, { marginBottom: 0 }]}>
              Amount (
              {selectedAsset?.isNative
                ? selectedAsset.network.symbol
                : selectedAsset?.token?.symbol || ""}
              )
            </Text>
            <Text style={styles.availableText}>
              Available: {selectedAsset?.balanceStr || "0"}
            </Text>
          </View>

          <View style={styles.inputContainer}>
            <TextInput
              style={styles.input}
              placeholder="0.0"
              placeholderTextColor="rgba(255,255,255,0.2)"
              value={amount}
              onChangeText={handleAmountChange}
              keyboardType="decimal-pad"
            />
            <HapticTouchableOpacity
              style={styles.maxButton}
              onPress={handleMax}
            >
              <Text style={styles.maxButtonText}>MAX</Text>
            </HapticTouchableOpacity>
          </View>

          <View style={styles.sliderPanel}>
            <View style={styles.sliderHeader}>
              <Text style={styles.sliderLabel}>Use Balance</Text>
              <Text style={styles.sliderPercent}>{amountPercent}%</Text>
            </View>
            <Slider
              style={styles.amountSlider}
              minimumValue={0}
              maximumValue={100}
              step={1}
              value={amountPercent}
              minimumTrackTintColor="#A855F7"
              maximumTrackTintColor="rgba(255,255,255,0.14)"
              thumbTintColor="#FFFFFF"
              disabled={!selectedAsset || availableBalance <= 0}
              onValueChange={setAmountByPercent}
            />
            <View style={styles.percentActions}>
              {[25, 50, 75, 100].map((percent) => (
                <HapticTouchableOpacity
                  key={percent}
                  style={[
                    styles.percentButton,
                    amountPercent === percent && styles.percentButtonActive,
                  ]}
                  disabled={!selectedAsset || availableBalance <= 0}
                  onPress={() => setAmountByPercent(percent)}
                >
                  <Text
                    style={[
                      styles.percentButtonText,
                      amountPercent === percent && styles.percentButtonTextActive,
                    ]}
                  >
                    {percent === 100 ? "MAX" : `${percent}%`}
                  </Text>
                </HapticTouchableOpacity>
              ))}
            </View>
          </View>

          <View style={{ height: 40 }} />
          <GradientButton
            label={isSending ? "Sending..." : "Review Send"}
            onPressed={validateAndPromptPin}
            disabled={isSending}
          />
        </View>
      </ScrollView>

      <BottomSheet
        visible={showReviewSheet}
        onClose={() => setShowReviewSheet(false)}
      >
        <View style={[sheetBaseStyle, { paddingBottom: Math.max(34, 24) }]}>
          <View style={{ alignItems: "center", paddingVertical: 12 }}>
            <View style={handleStyle as any} />
          </View>
          <Text style={styles.sheetTitle}>Confirm Transaction</Text>

          <View style={styles.reviewCard}>
            <View style={styles.reviewRow}>
              <Text style={styles.reviewLabel}>Asset</Text>
              <Text style={styles.reviewValue}>{assetSymbol}</Text>
            </View>
            <View style={styles.reviewRow}>
              <Text style={styles.reviewLabel}>Amount</Text>
              <Text style={styles.reviewValue}>{cleanAmount} {assetSymbol}</Text>
            </View>
            <View style={styles.reviewRow}>
              <Text style={styles.reviewLabel}>Estimated Value</Text>
              <Text style={styles.reviewValue}>${estimatedUsdValue.toFixed(2)}</Text>
            </View>
            <View style={styles.reviewRow}>
              <Text style={styles.reviewLabel}>Network</Text>
              <Text style={styles.reviewValue}>{selectedAsset?.network.name || "Unknown"}</Text>
            </View>
            <View style={styles.reviewRow}>
              <Text style={styles.reviewLabel}>Network Fee</Text>
              <Text style={styles.reviewValue}>Estimated by wallet</Text>
            </View>
            <View style={[styles.reviewRow, styles.reviewRowLast]}>
              <Text style={styles.reviewLabel}>Recipient</Text>
              <Text style={styles.reviewValue} numberOfLines={1} ellipsizeMode="middle">
                {address.trim()}
              </Text>
            </View>
          </View>

          <View style={styles.warningBox}>
            <Text style={styles.warningText}>
              Confirm the address and network before sending. Crypto transactions cannot be reversed.
            </Text>
          </View>

          <HapticTouchableOpacity
            style={styles.primaryAction}
            onPress={() => {
              setShowReviewSheet(false);
              setShowPin(true);
            }}
          >
            <Text style={styles.primaryActionText}>Confirm and Send</Text>
          </HapticTouchableOpacity>
        </View>
      </BottomSheet>

      <BottomSheet
        visible={showNetworkSheet}
        onClose={() => setShowNetworkSheet(false)}
      >
        <View style={[sheetBaseStyle, { paddingBottom: Math.max(34, 24) }]}>
          <View style={{ alignItems: "center", paddingVertical: 12 }}>
            <View style={handleStyle as any} />
          </View>
          <Text style={styles.sheetTitle}>Select Network</Text>

          <ScrollView
            style={{ maxHeight: 400, marginTop: 12, marginBottom: -12 }}
          >
            {selectableNetworks.map((network) => (
                <HapticTouchableOpacity
                  key={network.id}
                  style={styles.txCard}
                  onPress={() => {
                    setSelectedAssetId(network.id);
                    setShowNetworkSheet(false);
                  }}
                >
                  <View style={styles.networkLogoContainer}>
                    {getNetworkIcon(network.symbol, 40) || (
                      <View
                        style={{
                          width: 40,
                          height: 40,
                          borderRadius: 20,
                          backgroundColor: network.color || "#333",
                          justifyContent: "center",
                          alignItems: "center",
                        }}
                      >
                        <Text style={{ color: "white", fontWeight: "bold" }}>
                          {network.symbol[0]}
                        </Text>
                      </View>
                    )}
                  </View>
                  <View style={styles.txInfo}>
                    <Text style={styles.txTitle}>{network.name}</Text>
                  </View>
                  <View style={styles.txAmounts}>
                    <ChevronRight color="rgba(255,255,255,0.3)" size={20} />
                  </View>
                </HapticTouchableOpacity>
              ))}
          </ScrollView>
        </View>
      </BottomSheet>

      <BottomSheet
        visible={showTokenSheet}
        onClose={() => setShowTokenSheet(false)}
      >
        <View style={[sheetBaseStyle, { paddingBottom: Math.max(34, 24) }]}>
          <View style={{ alignItems: "center", paddingVertical: 12 }}>
            <View style={handleStyle as any} />
          </View>
          <Text style={styles.sheetTitle}>Select Asset</Text>

          <ScrollView
            style={{ maxHeight: 400, marginTop: 12, marginBottom: -12 }}
          >
            {allAssets
              .filter(
                (tb) =>
                  tb.network.id === selectedAsset?.network.id &&
                  Number(tb.balanceValue) > 0,
              )
              .map((tb) => (
                <HapticTouchableOpacity
                  key={tb.id}
                  style={styles.txCard}
                  onPress={() => {
                    setSelectedAssetId(tb.id);
                    setShowTokenSheet(false);
                  }}
                >
                  <View style={styles.networkLogoContainer}>
                    {tb.isNative ? (
                      getNetworkIcon(tb.network.symbol, 40)
                    ) : tb.token?.logoUrl ? (
                      <Image
                        source={{ uri: tb.token.logoUrl }}
                        style={{ width: 40, height: 40, borderRadius: 20 }}
                      />
                    ) : (
                      <View
                        style={{
                          width: 40,
                          height: 40,
                          borderRadius: 20,
                          backgroundColor: "#333",
                        }}
                      />
                    )}
                    {!tb.isNative && (
                      <View
                        style={{
                          position: "absolute",
                          bottom: -2,
                          right: -2,
                          borderRadius: 10,
                          backgroundColor: "#1C1C1E",
                        }}
                      >
                        {getNetworkIcon(tb.network.symbol, 16)}
                      </View>
                    )}
                  </View>
                  <View style={styles.txInfo}>
                    <Text style={[styles.txTitle, { marginBottom: 2 }]}>
                      {tb.isNative
                        ? tb.network.symbol
                        : tb.token?.symbol || "Token"}
                    </Text>
                    <Text style={styles.txSubtitle}>
                      {tb.isNative
                        ? tb.network.name
                        : tb.token?.name || "Token"}
                    </Text>
                  </View>
                  <View style={styles.txAmounts}>
                    <Text
                      style={[
                        styles.txTitle,
                        { marginBottom: 2, textAlign: "right" },
                      ]}
                    >
                      {tb.balanceStr}
                    </Text>
                  </View>
                </HapticTouchableOpacity>
              ))}
          </ScrollView>
        </View>
      </BottomSheet>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0B0B0E" },
  content: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 24,
    marginTop: 4,
    marginBottom: 24,
  },
  headerTitle: { color: "white", fontSize: 20, fontWeight: "bold" },
  form: { paddingHorizontal: 24 },
  label: {
    color: "rgba(255,255,255,0.7)",
    marginBottom: 12,
    fontSize: 14,
    fontWeight: "600",
    letterSpacing: 0.5,
  },

  // Standardized input container for token, address, and amount
  inputContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.06)",
    borderRadius: 16,
    paddingHorizontal: 16,
    height: 72,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.05)",
  },
  input: { flex: 1, color: "white", fontSize: 16 },

  assetSelectContent: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    flex: 1,
  },
  assetSelectLeft: { flexDirection: "row", alignItems: "center" },
  assetSelectTitle: { color: "white", fontSize: 16, fontWeight: "600" },
  assetSelectSubtitle: {
    color: "rgba(255,255,255,0.5)",
    fontSize: 13,
    marginTop: 2,
  },
  assetSelectPlaceholder: { color: "rgba(255,255,255,0.5)", fontSize: 16 },

  availableText: {
    color: "rgba(255,255,255,0.5)",
    fontSize: 12,
    fontWeight: "500",
  },
  maxButton: {
    backgroundColor: "rgba(168, 85, 247, 0.2)",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    marginLeft: 12,
  },
  maxButtonText: { color: "#A855F7", fontSize: 12, fontWeight: "700" },
  sliderPanel: {
    marginTop: 14,
    backgroundColor: "rgba(255,255,255,0.04)",
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 14,
  },
  sliderHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 4,
  },
  sliderLabel: {
    color: "rgba(255,255,255,0.55)",
    fontSize: 12,
    fontWeight: "700",
  },
  sliderPercent: {
    color: "white",
    fontSize: 13,
    fontWeight: "800",
  },
  amountSlider: {
    width: "100%",
    height: 36,
  },
  percentActions: {
    flexDirection: "row",
    gap: 8,
    marginTop: 6,
  },
  percentButton: {
    flex: 1,
    height: 34,
    borderRadius: 10,
    backgroundColor: "rgba(255,255,255,0.06)",
    alignItems: "center",
    justifyContent: "center",
  },
  percentButtonActive: {
    backgroundColor: "rgba(168, 85, 247, 0.22)",
    borderWidth: 1,
    borderColor: "rgba(168, 85, 247, 0.45)",
  },
  percentButtonText: {
    color: "rgba(255,255,255,0.62)",
    fontSize: 12,
    fontWeight: "800",
  },
  percentButtonTextActive: {
    color: "white",
  },

  txCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.05)",
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
  },
  networkLogoContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 16,
    justifyContent: "center",
    alignItems: "center",
  },
  txInfo: { flex: 1 },
  txTitle: { color: "white", fontSize: 16, fontWeight: "600", marginBottom: 4 },
  txSubtitle: { color: "rgba(255,255,255,0.7)", fontSize: 11 },
  txAmounts: { alignItems: "flex-end", justifyContent: "center" },
  sheetTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "white",
    marginBottom: 20,
    textAlign: "center",
  },
  reviewCard: {
    backgroundColor: "rgba(255,255,255,0.05)",
    borderRadius: 16,
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  reviewRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 16,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.08)",
    paddingVertical: 14,
  },
  reviewRowLast: { borderBottomWidth: 0 },
  reviewLabel: {
    color: "rgba(255,255,255,0.55)",
    fontSize: 13,
    fontWeight: "600",
  },
  reviewValue: {
    flex: 1,
    color: "white",
    fontSize: 14,
    fontWeight: "600",
    textAlign: "right",
  },
  warningBox: {
    backgroundColor: "rgba(255, 165, 0, 0.1)",
    borderRadius: 12,
    padding: 14,
    marginBottom: 16,
  },
  warningText: {
    color: "orange",
    fontSize: 12,
    textAlign: "center",
    lineHeight: 18,
  },
  primaryAction: {
    backgroundColor: "#A855F7",
    borderRadius: 14,
    paddingVertical: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  primaryActionDisabled: {
    backgroundColor: "rgba(255,255,255,0.08)",
  },
  primaryActionText: { color: "white", fontWeight: "700", fontSize: 15 },
  primaryActionTextDisabled: { color: "rgba(255,255,255,0.35)" },
  secondaryAction: {
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: "center",
    marginTop: 12,
    backgroundColor: "rgba(255,255,255,0.08)",
  },
  secondaryActionText: { color: "white", fontWeight: "700", fontSize: 15 },
  statusScreen: {
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: 24,
  },
  statusIconBox: {
    width: 88,
    height: 88,
    borderRadius: 44,
    alignItems: "center",
    justifyContent: "center",
    alignSelf: "center",
    marginBottom: 20,
  },
  statusTitle: {
    color: "white",
    fontSize: 24,
    fontWeight: "800",
    textAlign: "center",
    marginBottom: 8,
  },
  statusSubtitle: {
    color: "rgba(255,255,255,0.65)",
    fontSize: 14,
    lineHeight: 20,
    textAlign: "center",
    marginBottom: 24,
  },
});
