/**
 * PaymentScreen — FUTURE FEATURE
 * Displays subscription plans and allows users to subscribe to premium.
 * Actual payment provider integration is stubbed pending provider setup.
 */

import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import type { Subscription, SubscriptionPlan, SubscriptionPlanDetails } from '../models/Payment';
import paymentService from '../services/paymentService';

const PaymentScreen: React.FC = () => {
  const [plans, setPlans] = useState<SubscriptionPlanDetails[]>([]);
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<SubscriptionPlan | null>(null);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const [fetchedPlans, fetchedSub] = await Promise.all([
        paymentService.getPlans(),
        paymentService.getSubscription(),
      ]);
      setPlans(fetchedPlans);
      setSubscription(fetchedSub);
    } catch {
      Alert.alert('Error', 'Failed to load subscription plans. Please try again.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const handleSubscribe = async (plan: SubscriptionPlan) => {
    if (plan === 'free') return;
    setSelectedPlan(plan);
    setProcessing(true);
    try {
      // Stub: in production, trigger Apple IAP / Google Play / Stripe here
      // and pass the providerTransactionId to initiatePayment
      const payment = await paymentService.initiatePayment(plan, 'stub');
      const result = await paymentService.confirmPayment(payment.id);
      setSubscription(result.subscription);
      Alert.alert(
        'Success',
        `You are now subscribed to ${result.subscription.plan.replace('_', ' ')}!`,
      );
    } catch (err) {
      Alert.alert(
        'Payment Failed',
        err instanceof Error ? err.message : 'Unable to process payment.',
      );
    } finally {
      setProcessing(false);
      setSelectedPlan(null);
    }
  };

  const handleCancel = () => {
    Alert.alert(
      'Cancel Subscription',
      'Your subscription will remain active until the end of the current billing period.',
      [
        { text: 'Keep Subscription', style: 'cancel' },
        {
          text: 'Cancel',
          style: 'destructive',
          onPress: async () => {
            try {
              const updated = await paymentService.cancelSubscription();
              setSubscription(updated);
              Alert.alert('Cancelled', 'Your subscription will end at the current period end.');
            } catch {
              Alert.alert('Error', 'Failed to cancel subscription.');
            }
          },
        },
      ],
    );
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#4CAF50" />
      </View>
    );
  }

  const isActive = subscription?.status === 'active';

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.heading}>Premium Plans</Text>
      <Text style={styles.subheading}>Unlock the full PetChain experience</Text>

      {/* Future feature notice */}
      <View style={styles.futureBanner}>
        <Text style={styles.futureBannerText}>
          🚧 Payment integration coming soon. Plans shown for preview only.
        </Text>
      </View>

      {/* Active subscription status */}
      {isActive && (
        <View style={styles.activeCard}>
          <Text style={styles.activeTitle}>Current Plan</Text>
          <Text style={styles.activePlan}>
            {subscription?.plan.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())}
          </Text>
          <Text style={styles.activePeriod}>
            Renews:{' '}
            {subscription?.currentPeriodEnd
              ? new Date(subscription.currentPeriodEnd).toLocaleDateString()
              : ''}
          </Text>
          {subscription?.cancelAtPeriodEnd && (
            <Text style={styles.cancelNotice}>Cancels at period end</Text>
          )}
          {!subscription?.cancelAtPeriodEnd && (
            <TouchableOpacity style={styles.cancelButton} onPress={handleCancel}>
              <Text style={styles.cancelButtonText}>Cancel Subscription</Text>
            </TouchableOpacity>
          )}
        </View>
      )}

      {/* Plan cards */}
      {plans
        .filter((p) => p.id !== 'free')
        .map((plan) => {
          const isCurrent = subscription?.plan === plan.id && isActive;
          const isProcessing = processing && selectedPlan === plan.id;

          return (
            <View key={plan.id} style={[styles.planCard, isCurrent && styles.planCardActive]}>
              {isCurrent && <Text style={styles.currentBadge}>Current Plan</Text>}
              <Text style={styles.planName}>{plan.name}</Text>
              <Text style={styles.planDescription}>{plan.description}</Text>
              <Text style={styles.planPrice}>
                ${plan.priceMonthly.toFixed(2)} <Text style={styles.planPricePer}>/month</Text>
              </Text>
              {plan.id === 'premium_annual' && (
                <Text style={styles.savingsLabel}>Save 20% vs monthly</Text>
              )}

              <View style={styles.featureList}>
                {plan.features.map((feature) => (
                  <Text key={feature} style={styles.featureItem}>
                    ✓ {feature}
                  </Text>
                ))}
              </View>

              {!isCurrent && (
                <TouchableOpacity
                  style={[styles.subscribeButton, isProcessing && styles.subscribeButtonDisabled]}
                  onPress={() => void handleSubscribe(plan.id)}
                  disabled={isProcessing || processing}
                >
                  {isProcessing ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <Text style={styles.subscribeButtonText}>Subscribe</Text>
                  )}
                </TouchableOpacity>
              )}
            </View>
          );
        })}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  content: { padding: 18, paddingBottom: 40 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  heading: { fontSize: 24, fontWeight: '700', color: '#111', marginBottom: 4 },
  subheading: { fontSize: 14, color: '#666', marginBottom: 16 },
  futureBanner: {
    backgroundColor: '#FFF3CD',
    borderRadius: 10,
    padding: 12,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#FFEAA7',
  },
  futureBannerText: { fontSize: 13, color: '#856404' },
  activeCard: {
    backgroundColor: '#E8F5E9',
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#4CAF50',
  },
  activeTitle: { fontSize: 12, color: '#4CAF50', fontWeight: '600', marginBottom: 4 },
  activePlan: { fontSize: 18, fontWeight: '700', color: '#111', marginBottom: 4 },
  activePeriod: { fontSize: 13, color: '#555' },
  cancelNotice: { fontSize: 13, color: '#E53935', marginTop: 6 },
  cancelButton: { marginTop: 12, alignSelf: 'flex-start' },
  cancelButtonText: { fontSize: 13, color: '#E53935', textDecorationLine: 'underline' },
  planCard: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  planCardActive: { borderColor: '#4CAF50', borderWidth: 2 },
  currentBadge: {
    fontSize: 11,
    fontWeight: '700',
    color: '#4CAF50',
    textTransform: 'uppercase',
    marginBottom: 6,
  },
  planName: { fontSize: 20, fontWeight: '700', color: '#111', marginBottom: 4 },
  planDescription: { fontSize: 13, color: '#666', marginBottom: 10 },
  planPrice: { fontSize: 28, fontWeight: '800', color: '#111' },
  planPricePer: { fontSize: 14, fontWeight: '400', color: '#666' },
  savingsLabel: {
    fontSize: 12,
    color: '#4CAF50',
    fontWeight: '600',
    marginTop: 2,
    marginBottom: 8,
  },
  featureList: { marginTop: 12, marginBottom: 16 },
  featureItem: { fontSize: 13, color: '#444', marginBottom: 6 },
  subscribeButton: {
    backgroundColor: '#4CAF50',
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
  },
  subscribeButtonDisabled: { backgroundColor: '#A5D6A7' },
  subscribeButtonText: { color: '#fff', fontWeight: '700', fontSize: 15 },
});

export default PaymentScreen;
