import React, { useState, useEffect } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, Alert } from 'react-native';

interface AssetProvenance {
  account: string;
  timestamp: string;
  type: string;
}

export const PetNFTScreen = () => {
  const [provenance, setProvenance] = useState<AssetProvenance[]>([]);
  const [isFrozen, setIsFrozen] = useState(false);

  useEffect(() => {
    // Mock data for demonstration
    setProvenance([{ account: 'GDEGO63V2F', timestamp: '2026-05-29', type: 'Ownership Received' }]);
  }, []);

  const handleFreezeAsset = () => {
    setIsFrozen(!isFrozen);
    Alert.alert(
      isFrozen ? 'Asset Unfrozen' : 'Asset Frozen',
      isFrozen
        ? 'The pet identity asset is now unfrozen.'
        : 'The pet identity asset has been frozen.',
    );
  };

  const handleListOnDEX = () => {
    Alert.alert(
      'List on DEX',
      'This would list the pet identity asset on the Stellar decentralized exchange.',
    );
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Pet Identity NFT</Text>

      <View style={styles.buttonContainer}>
        <TouchableOpacity
          style={[styles.button, isFrozen ? styles.frozenButton : null]}
          onPress={handleFreezeAsset}
        >
          <Text style={styles.buttonText}>
            {isFrozen ? 'Unfreeze Asset' : 'Freeze Asset (Lost/Stolen)'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.button} onPress={handleListOnDEX}>
          <Text style={styles.buttonText}>List on Stellar DEX</Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.sectionTitle}>Provenance History</Text>
      <FlatList
        data={provenance}
        keyExtractor={(item, index) => `${index}-${item.timestamp}`}
        renderItem={({ item }) => (
          <View style={styles.provenanceItem}>
            <Text style={styles.provenanceType}>{item.type}</Text>
            <Text style={styles.provenanceAccount}>{item.account}</Text>
            <Text style={styles.provenanceTimestamp}>{item.timestamp}</Text>
          </View>
        )}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: '#ffffff',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 20,
  },
  buttonContainer: {
    gap: 10,
    marginBottom: 30,
  },
  button: {
    padding: 15,
    borderRadius: 10,
    backgroundColor: '#4CAF50',
  },
  frozenButton: {
    backgroundColor: '#f44336',
  },
  buttonText: {
    color: 'white',
    textAlign: 'center',
    fontSize: 16,
    fontWeight: 'bold',
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  provenanceItem: {
    padding: 15,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 10,
    marginBottom: 10,
  },
  provenanceType: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 5,
  },
  provenanceAccount: {
    fontSize: 14,
    color: '#666666',
    marginBottom: 5,
  },
  provenanceTimestamp: {
    fontSize: 14,
    color: '#666666',
  },
});

export default PetNFTScreen;
