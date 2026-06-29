import React, { useEffect, useRef } from 'react';
import { Tabs } from 'expo-router';
import { View, TouchableWithoutFeedback, StyleSheet, Platform, Animated, Dimensions, Text } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ArrowRightLeft, HomeIcon, WalletIcon } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const TAB_BAR_WIDTH = SCREEN_WIDTH - 48; // taking into account paddingHorizontal: 24
const TAB_COUNT = 3;
const TAB_WIDTH = TAB_BAR_WIDTH / TAB_COUNT;

function CustomTabBar({ state, descriptors, navigation }: any) {
  const insets = useSafeAreaInsets();
  
  // Track animation for the pill slider
  const slideAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.spring(slideAnim, {
      toValue: state.index * TAB_WIDTH,
      useNativeDriver: true,
      bounciness: 10,
      speed: 12,
    }).start();
  }, [state.index]);
  
  return (
    <View style={[styles.tabBarContainer, { paddingBottom: Math.max(insets.bottom, 16) }]}>
      <View style={styles.tabBar}>
        
        {/* Animated Background Pill */}
        <Animated.View style={[
          styles.activeIndicator,
          { transform: [{ translateX: slideAnim }] }
        ]}>
          <View style={styles.activeIndicatorPill} />
        </Animated.View>

        {state.routes.map((route: any, index: number) => {
          const { options } = descriptors[route.key];
          const isFocused = state.index === index;

          const onPress = () => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            const event = navigation.emit({
              type: 'tabPress',
              target: route.key,
              canPreventDefault: true,
            });

            if (!isFocused && !event.defaultPrevented) {
              navigation.navigate(route.name);
            }
          };

          let IconComponent;
          if (route.name === 'transactions') IconComponent = ArrowRightLeft;
          else if (route.name === 'index') IconComponent = HomeIcon;
          else if (route.name === 'assets') IconComponent = WalletIcon;

          return (
            <TouchableWithoutFeedback
              key={route.key}
              accessibilityRole="button"
              accessibilityState={isFocused ? { selected: true } : {}}
              accessibilityLabel={options.tabBarAccessibilityLabel}
              testID={options.tabBarTestID}
              onPress={onPress}
            >
              <View style={styles.tabButton}>
                {IconComponent && (
                  <IconComponent 
                    color={isFocused ? '#ffffff' : '#8E8E93'} 
                    size={isFocused ? 22 : 24} 
                    strokeWidth={isFocused ? 2.5 : 2}
                  />
                )}
              </View>
            </TouchableWithoutFeedback>
          );
        })}
      </View>
    </View>
  );
}

export default function TabsLayout() {
  return (
    <Tabs 
      tabBar={props => <CustomTabBar {...props} />}
      screenOptions={{ 
        headerShown: false,
        sceneStyle: { backgroundColor: '#0B0B0E' }
      }}
    >
      <Tabs.Screen name="transactions" />
      <Tabs.Screen name="index" />
      <Tabs.Screen name="assets" />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  tabBarContainer: {
    position: 'absolute',
    bottom: 0,
    width: '100%',
    alignItems: 'center',
    backgroundColor: 'transparent',
    paddingHorizontal: 24,
  },
  tabBar: {
    flexDirection: 'row',
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    width: '100%',
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    backgroundColor: 'rgba(28, 28, 30, 0.95)',
  },
  activeIndicator: {
    position: 'absolute',
    left: 0,
    width: TAB_WIDTH,
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 0,
  },
  activeIndicatorPill: {
    width: 52, 
    height: 52,
    backgroundColor: '#9C2CF0', 
    borderRadius: 26,
  },
  tabButton: {
    flex: 1,
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1,
  },
});
