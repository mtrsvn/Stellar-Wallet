import { FontAwesome } from "@expo/vector-icons";
import { CameraView, useCameraPermissions } from "expo-camera";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import React, { useEffect, useRef } from "react";
import {
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
    Linking,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

export default function ScanScreen() {
  const router = useRouter();
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

    router.replace({
      pathname: "/(tabs)",
      params: { scannedAddress: result.data, scanId: String(Date.now()) },
    });
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
          <TouchableOpacity style={styles.closeButton} onPress={closeScanner}>
            <FontAwesome name="times" size={18} color="white" />
          </TouchableOpacity>
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
              <TouchableOpacity
                style={styles.permissionButton}
                onPress={handleRequestPermission}
              >
                <Text style={styles.permissionButtonText}>Allow Camera</Text>
              </TouchableOpacity>
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
