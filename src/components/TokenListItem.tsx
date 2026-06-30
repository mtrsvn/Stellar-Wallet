import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Image } from 'react-native';
import { TokenBalance } from '../context/WalletContext';
import { getNetworkIcon } from './NetworkIcons';

interface TokenListItemProps {
  item: TokenBalance;
}

export function TokenListItem({ item }: TokenListItemProps) {
  const mainSymbol = item.isNative ? item.network.symbol : item.token?.symbol || 'UNK';
  const mainName = item.isNative ? item.network.name : item.token?.name || 'Unknown Token';
  
  return (
    <View style={styles.container}>
      <View style={styles.iconContainer}>
        {item.isNative ? (
          <View style={styles.mainIcon}>
            {getNetworkIcon(item.network.symbol, 44)}
          </View>
        ) : (
          <View style={styles.mainIcon}>
            {item.token?.logoUrl ? (
              <Image source={{ uri: item.token.logoUrl }} style={{ width: 44, height: 44, borderRadius: 22 }} />
            ) : (
              <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: '#333' }} />
            )}
          </View>
        )}
        
        {/* Network Badge for Tokens */}
        <View style={styles.badgeContainer}>
          {getNetworkIcon(item.network.symbol, 16)}
        </View>
      </View>
      
      <View style={styles.detailsContainer}>
        <Text style={styles.symbolText}>{mainSymbol}</Text>
        <Text style={styles.nameText}>{mainName}</Text>
      </View>
      
      <View style={styles.balanceContainer}>
        <Text style={styles.usdText}>${item.usdValue.toFixed(2)}</Text>
        <Text style={styles.balanceText}>{item.balanceStr}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 20,
    backgroundColor: '#1C1C1E',
    borderRadius: 16,
    marginBottom: 12,
  },
  iconContainer: {
    width: 44,
    height: 44,
    marginRight: 16,
    position: 'relative',
  },
  mainIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
  },
  badgeContainer: {
    position: 'absolute',
    bottom: -4,
    right: -4,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#1C1C1E', // Match row background
    justifyContent: 'center',
    alignItems: 'center',
  },
  detailsContainer: {
    flex: 1,
  },
  symbolText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  nameText: {
    color: '#8E8E93',
    fontSize: 14,
  },
  balanceContainer: {
    alignItems: 'flex-end',
  },
  usdText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  balanceText: {
    color: '#8E8E93',
    fontSize: 14,
  },
});
