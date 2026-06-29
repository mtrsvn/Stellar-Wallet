import { HapticTouchableOpacity } from '../src/components/HapticTouchableOpacity';
import { FontAwesome } from "@expo/vector-icons";
import { CameraView, useCameraPermissions, scanFromURLAsync } from "expo-camera";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter, useLocalSearchParams } from "expo-router";
import React, { useEffect, useRef } from "react";
import {
    StyleSheet,
    Text,
    View,
    Linking,
    Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import * as ImagePicker from 'expo-image-picker';

import { useWallet } from '../src/context/WalletContext';

export default function ScanScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const wallet = useWallet();
  const [permission, requestPermission] = useCameraPermissions();

  const handleRequestPermission = async () => {
    if (permission?.status === "denied" && !permission.canAskAgain) {
      Linking.openSettings();
    } else {
      await requestPermission();
    }
  };

  const closeScanner = () => {
    router.back();
  };

  const handleScanned = (result: { data: string }) => {
    if (!result.data) return;
    const address = result.data.trim();

    // 1. Auto-detect network from address format
    let detectedNetworkType: 'EVM' | 'SOL' | 'BTC' | null = null;
    if (address.startsWith('0x') && address.length === 42) {
      detectedNetworkType = 'EVM';
    } else if (/^(bc1|[13])[a-zA-HJ-NP-Z0-9]{25,39}$/.test(address)) {
      detectedNetworkType = 'BTC';
    } else if (/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(address)) {
      detectedNetworkType = 'SOL';
    }

    // 2. Find matching native asset
    let detectedAssetId = params.assetId as string | undefined;
    const currentAsset = wallet.tokenBalances?.find(t => t.id === detectedAssetId);

    if (detectedNetworkType && currentAsset?.network.type !== detectedNetworkType) {
       const matchingAsset = wallet.tokenBalances?.find(t => t.isNative && t.network.type === detectedNetworkType);
       if (matchingAsset) {
          detectedAssetId = matchingAsset.id;
       }
    }

    const returnTo = params.returnTo as string;
    if (returnTo) {
      router.replace({
        pathname: returnTo as any,
        params: { ...params, to: address, scanId: String(Date.now()), assetId: detectedAssetId },
      });
    } else {
      if (detectedAssetId) {
         // Auto-route straight to send if we know the asset
         router.replace({
           pathname: "/send",
           params: { to: address, assetId: detectedAssetId }
         });
      } else {
         router.replace({
           pathname: "/(tabs)",
           params: { scannedAddress: address, scanId: String(Date.now()) },
         });
      }
    }
  };

  const pickImage = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: false,
        quality: 1,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const scannedResults = await scanFromURLAsync(result.assets[0].uri, ["qr"]);
        if (scannedResults.length > 0) {
          handleScanned({ data: scannedResults[0].data });
        } else {
          Alert.alert("No QR Code", "We couldn't find a QR code in that image.");
        }
      }
    } catch (e) {
      Alert.alert("Error", "Failed to scan image.");
    }
  };

  return (
    <SafeAreaView style={styles.screen} edges={["top", "left", "right"]}>
      <LinearGradient
        colors={["#090A0D", "#111216", "#060607"]}
        style={styles.background}
      >
        <View style={styles.topBar}>
          <View>
            <Text style={styles.eyebrow}>QR Scanner</Text>
            <Text style={styles.title}>Scan address</Text>
          </View>
          <View style={{ flexDirection: 'row', gap: 12 }}>
            <HapticTouchableOpacity style={styles.closeButton} onPress={pickImage}>
              <FontAwesome name="image" size={18} color="white" />
            </HapticTouchableOpacity>
            <HapticTouchableOpacity style={styles.closeButton} onPress={closeScanner}>
              <FontAwesome name="times" size={18} color="white" />
            </HapticTouchableOpacity>
          </View>
        </View>

        <View style={styles.body}>
          {permission?.granted ? (
            <View style={styles.frameShell}>
              <CameraView
                style={StyleSheet.absoluteFill}
                facing="back"
                barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
                onMountError={() => {
                  router.back();
                }}
                onBarcodeScanned={handleScanned}
              />

              <View pointerEvents="none" style={styles.overlay}>
                <View style={styles.frame}>
                  <View style={[styles.corner, styles.cornerTopLeft]} />
                  <View style={[styles.corner, styles.cornerTopRight]} />
                  <View style={[styles.corner, styles.cornerBottomLeft]} />
                  <View style={[styles.corner, styles.cornerBottomRight]} />
                </View>

                <View style={styles.hintCard}>
                  <FontAwesome name="qrcode" size={16} color="white" />
                  <Text style={styles.hintText}>
                    Align the QR code inside the frame
                  </Text>
                </View>
              </View>
            </View>
          ) : (
            <View style={styles.permissionCard}>
              <View style={styles.permissionIcon}>
                <FontAwesome name="camera" size={24} color="white" />
              </View>
              <Text style={styles.permissionTitle}>Camera access needed</Text>
              <Text style={styles.permissionText}>
                Grant permission so we can scan your QR code instantly.
              </Text>
              <HapticTouchableOpacity
                style={styles.permissionButton}
                onPress={handleRequestPermission}
              >
                <Text style={styles.permissionButtonText}>Allow Camera</Text>
              </HapticTouchableOpacity>
            </View>
          )}
        </View>
      </LinearGradient>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#090A0D" },
  background: { flex: 1 },
  topBar: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 12,
  },
  eyebrow: {
    color: "rgba(255,255,255,0.55)",
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1.8,
    textTransform: "uppercase",
    marginBottom: 4,
  },
  title: { color: "white", fontSize: 22, fontWeight: "800" },
  closeButton: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: "rgba(255,255,255,0.08)",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },
  body: { flex: 1, padding: 16, paddingTop: 8 },
  frameShell: {
    flex: 1,
    borderRadius: 28,
    overflow: "hidden",
    backgroundColor: "#0A0B0D",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
  },
  frame: {
    width: "82%",
    aspectRatio: 1,
    borderRadius: 28,
    backgroundColor: "rgba(255,255,255,0.02)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },
  corner: {
    position: "absolute",
    width: 28,
    height: 28,
    borderColor: "#FFFFFF",
  },
  cornerTopLeft: {
    top: 14,
    left: 14,
    borderTopWidth: 4,
    borderLeftWidth: 4,
    borderTopLeftRadius: 14,
  },
  cornerTopRight: {
    top: 14,
    right: 14,
    borderTopWidth: 4,
    borderRightWidth: 4,
    borderTopRightRadius: 14,
  },
  cornerBottomLeft: {
    bottom: 14,
    left: 14,
    borderBottomWidth: 4,
    borderLeftWidth: 4,
    borderBottomLeftRadius: 14,
  },
  cornerBottomRight: {
    bottom: 14,
    right: 14,
    borderBottomWidth: 4,
    borderRightWidth: 4,
    borderBottomRightRadius: 14,
  },
  hintCard: {
    marginTop: 24,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.08)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },
  hintText: { color: "white", fontSize: 14, fontWeight: "600" },
  permissionCard: {
    flex: 1,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
    backgroundColor: "rgba(255,255,255,0.04)",
    gap: 12,
  },
  permissionIcon: {
    width: 74,
    height: 74,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(156,44,240,0.28)",
  },
  permissionTitle: { color: "white", fontSize: 20, fontWeight: "800" },
  permissionText: {
    color: "rgba(255,255,255,0.72)",
    textAlign: "center",
    fontSize: 14,
    lineHeight: 20,
  },
  permissionButton: {
    marginTop: 8,
    backgroundColor: "#9C2CF0",
    paddingHorizontal: 18,
    paddingVertical: 14,
    borderRadius: 16,
  },
  permissionButtonText: { color: "white", fontWeight: "800", fontSize: 15 },
});
