import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

import type { Subscription, SubscriptionPlan, SubscriptionPlanDetails } from '../models/Payment';
import paymentService from '../services/paymentService';
import { getPublicKeyFromStoredSecret, getStoredSecret } from '../services/stellarAccountService';
import stellarPathPaymentService, {
  type PathPaymentAuditEntry,
  type PathPaymentQuote,
  type PreparedPayment,
} from '../services/stellarPathPaymentService';

const PaymentScreen: React.FC = () => {
  const [plans, setPlans] = useState<SubscriptionPlanDetails[]>([]);
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [loading, setLoading] = useState(true);
  const [preparing, setPreparing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<SubscriptionPlan | null>(null);
  const [sourceAssetCode, setSourceAssetCode] = useState('XLM');
  const [sourceAssetIssuer, setSourceAssetIssuer] = useState('');
  const [stellarPublicKey, setStellarPublicKey] = useState<string | null>(null);
  const [preparedPayment, setPreparedPayment] = useState<PreparedPayment | null>(null);
  const [quote, setQuote] = useState<PathPaymentQuote | null>(null);
  const [audits, setAudits] = useState<PathPaymentAuditEntry[]>([]);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const [fetchedPlans, fetchedSub, publicKey] = await Promise.all([
        paymentService.getPlans(),
        paymentService.getSubscription(),
        getPublicKeyFromStoredSecret(),
      ]);
      setPlans(fetchedPlans);
      setSubscription(fetchedSub);
      setStellarPublicKey(publicKey);
    } catch {
      Alert.alert('Error', 'Failed to load subscription plans. Please try again.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const currentPrice = useCallback((plan: SubscriptionPlanDetails) => {
    return plan.id === 'premium_annual' ? plan.priceAnnual : plan.priceMonthly;
  }, []);

  const handlePrepareQuote = async (plan: SubscriptionPlan) => {
    const sourceCode = sourceAssetCode.trim().toUpperCase();
    const issuer = sourceAssetIssuer.trim();
    const sourceAccount = stellarPublicKey ?? (await getPublicKeyFromStoredSecret());

    if (!sourceAccount) {
      Alert.alert(
        'Stellar account required',
        'Save a Stellar secret key in Stellar Account before paying with a custom asset.',
      );
      return;
    }

    if (sourceCode !== 'XLM' && !issuer) {
      Alert.alert('Issuer required', 'Enter the issuer public key for non-XLM assets.');
      return;
    }

    setSelectedPlan(plan);
    setPreparing(true);
    try {
      const prepared = await stellarPathPaymentService.preparePathPayment({
        plan,
        sourceAsset: {
          code: sourceCode,
          issuer: sourceCode === 'XLM' ? undefined : issuer,
          type: sourceCode === 'XLM' ? 'native' : 'credit_alphanum4',
        },
        sourceAccountPublicKey: sourceAccount,
      });

      setPreparedPayment(prepared);
      setQuote(prepared.quote);
      setAudits(await stellarPathPaymentService.getPathPaymentAudits(prepared.payment.id));
      Alert.alert(
        'Quote ready',
        prepared.quote.mode === 'path'
          ? 'A conversion path was found. Review the rate and fee before confirming.'
          : 'No conversion path was found, so the quote falls back to a direct XLM payment.',
      );
    } catch (error) {
      Alert.alert(
        'Quote failed',
        error instanceof Error ? error.message : 'Unable to prepare the Stellar payment.',
      );
    } finally {
      setPreparing(false);
    }
  };

  const handleConfirmPayment = async () => {
    if (!preparedPayment) return;

    setSubmitting(true);
    try {
      const secret = await getStoredSecret();
      const signedTransactionXdr = await stellarPathPaymentService.signTransactionXdr(
        preparedPayment.transactionXdr,
        secret,
      );

      const result = await stellarPathPaymentService.submitPathPayment({
        paymentId: preparedPayment.payment.id,
        signedTransactionXdr,
      });

      setSubscription(result.subscription);
      setAudits(await stellarPathPaymentService.getPathPaymentAudits(result.payment.id));
      setPreparedPayment(null);
      setQuote(null);
      Alert.alert(
        'Payment confirmed',
        `Your ${result.payment.plan.replace('_', ' ')} subscription is active. Tx: ${result.transactionHash}`,
      );
    } catch (error) {
      Alert.alert(
        'Payment failed',
        error instanceof Error ? error.message : 'Unable to submit the Stellar payment.',
      );
    } finally {
      setSubmitting(false);
    }
  };

  const isActive = subscription?.status === 'active';
  const currentPlanLabel = useMemo(() => {
    if (!subscription) return 'No active subscription';
    return subscription.plan.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
  }, [subscription]);

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#0f766e" />
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.heading}>Premium Plans</Text>
      <Text style={styles.subheading}>Pay with any Stellar asset and convert to XLM on-chain.</Text>

      {stellarPublicKey ? (
        <View style={styles.accountBanner}>
          <Text style={styles.accountBannerLabel}>Signing account</Text>
          <Text style={styles.accountBannerValue} numberOfLines={1}>
            {stellarPublicKey}
          </Text>
        </View>
      ) : (
        <View style={styles.warnBanner}>
          <Text style={styles.warnText}>
            Add a Stellar secret key in Stellar Account to sign the payment transaction locally.
          </Text>
        </View>
      )}

      <View style={styles.quoteCard}>
        <Text style={styles.sectionTitle}>Stellar asset payment</Text>
        <Text style={styles.helperText}>
          Enter the asset you want to pay with. For example: XLM, USDC, or a testnet asset.
        </Text>
        <View style={styles.row}>
          <TextInput
            style={styles.input}
            value={sourceAssetCode}
            onChangeText={setSourceAssetCode}
            placeholder="Asset code"
            placeholderTextColor="#8f8f8f"
            autoCapitalize="characters"
          />
          <TextInput
            style={styles.input}
            value={sourceAssetIssuer}
            onChangeText={setSourceAssetIssuer}
            placeholder="Issuer public key"
            placeholderTextColor="#8f8f8f"
            autoCapitalize="characters"
          />
        </View>
        <Text style={styles.helperText}>
          If the chosen asset has no conversion path, we automatically fall back to a direct XLM
          payment.
        </Text>
      </View>

      {isActive && (
        <View style={styles.activeCard}>
          <Text style={styles.activeTitle}>Current Plan</Text>
          <Text style={styles.activePlan}>{currentPlanLabel}</Text>
          <Text style={styles.activePeriod}>
            Renews:{' '}
            {subscription?.currentPeriodEnd
              ? new Date(subscription.currentPeriodEnd).toLocaleDateString()
              : ''}
          </Text>
          {subscription?.cancelAtPeriodEnd ? (
            <Text style={styles.cancelNotice}>Cancels at period end</Text>
          ) : null}
        </View>
      )}

      {plans
        .filter((p) => p.id !== 'free')
        .map((plan) => {
          const isSelected = selectedPlan === plan.id;
          const price = currentPrice(plan);
          return (
            <View key={plan.id} style={[styles.planCard, isSelected && styles.planCardActive]}>
              <Text style={styles.planName}>{plan.name}</Text>
              <Text style={styles.planDescription}>{plan.description}</Text>
              <Text style={styles.planPrice}>
                ${price.toFixed(2)}{' '}
                <Text style={styles.planPricePer}>
                  / {plan.id === 'premium_annual' ? 'year' : 'month'}
                </Text>
              </Text>
              {plan.id === 'premium_annual' ? (
                <Text style={styles.savingsLabel}>Save 20% vs monthly</Text>
              ) : null}

              <View style={styles.featureList}>
                {plan.features.map((feature) => (
                  <Text key={feature} style={styles.featureItem}>
                    ✓ {feature}
                  </Text>
                ))}
              </View>

              <TouchableOpacity
                style={[styles.subscribeButton, preparing && styles.subscribeButtonDisabled]}
                onPress={() => void handlePrepareQuote(plan.id)}
                disabled={preparing || submitting}
              >
                {preparing && isSelected ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.subscribeButtonText}>Get Stellar quote</Text>
                )}
              </TouchableOpacity>
            </View>
          );
        })}

      {quote && preparedPayment ? (
        <View style={styles.quoteCard}>
          <Text style={styles.sectionTitle}>Quote preview</Text>
          <Text style={styles.quoteLine}>
            Mode: {quote.mode === 'path' ? 'Path payment' : 'Direct XLM fallback'}
          </Text>
          <Text style={styles.quoteLine}>Destination: {quote.destinationAmount} XLM</Text>
          <Text style={styles.quoteLine}>
            Source: {quote.sourceAmount} {quote.sourceAsset.code}
          </Text>
          <Text style={styles.quoteLine}>Exchange rate: {quote.exchangeRate}</Text>
          <Text style={styles.quoteLine}>Network fee: ~{quote.estimatedNetworkFee} XLM</Text>
          <Text style={styles.quoteLine}>Path hops: {quote.pathCount}</Text>
          {quote.fallbackReason ? (
            <Text style={styles.fallbackText}>{quote.fallbackReason}</Text>
          ) : null}

          <Text style={styles.auditTitle}>Route</Text>
          {quote.path.length > 0 ? (
            quote.path.map((step, index) => (
              <Text key={`${step.code}-${index}`} style={styles.auditLine}>
                {index + 1}. {step.code}
                {step.issuer ? ` (${step.issuer.slice(0, 8)}...)` : ''}
              </Text>
            ))
          ) : (
            <Text style={styles.auditLine}>Direct payment to the treasury account</Text>
          )}

          <TouchableOpacity
            style={[styles.confirmButton, submitting && styles.confirmButtonDisabled]}
            onPress={() => void handleConfirmPayment()}
            disabled={submitting}
          >
            {submitting ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text style={styles.confirmButtonText}>Sign and confirm</Text>
            )}
          </TouchableOpacity>
          <Text style={styles.helperText}>
            The transaction is signed locally using the stored Stellar secret key and then submitted
            to Horizon.
          </Text>
        </View>
      ) : null}

      {audits.length > 0 ? (
        <View style={styles.quoteCard}>
          <Text style={styles.sectionTitle}>Audit trail</Text>
          {audits.map((entry) => (
            <View key={entry.id} style={styles.auditBlock}>
              <Text style={styles.auditTitle}>
                {entry.mode.toUpperCase()} {entry.plan}
              </Text>
              <Text style={styles.auditLine}>
                Source: {entry.sourceAsset.code} | Dest: {entry.destinationAmount} XLM | Rate:{' '}
                {entry.exchangeRate}
              </Text>
              <Text style={styles.auditLine}>Fee: {entry.estimatedNetworkFee} XLM</Text>
              {entry.fallbackReason ? (
                <Text style={styles.fallbackText}>{entry.fallbackReason}</Text>
              ) : null}
              {entry.transactionHash ? (
                <Text style={styles.auditLine}>Tx: {entry.transactionHash}</Text>
              ) : null}
            </View>
          ))}
        </View>
      ) : null}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f2' },
  content: { padding: 18, paddingBottom: 40 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  heading: { fontSize: 24, fontWeight: '800', color: '#12372a', marginBottom: 4 },
  subheading: { fontSize: 14, color: '#60756b', marginBottom: 16 },
  accountBanner: {
    backgroundColor: '#12372a',
    borderRadius: 16,
    padding: 14,
    marginBottom: 16,
  },
  accountBannerLabel: {
    color: '#9fd7c7',
    fontSize: 12,
    textTransform: 'uppercase',
    fontWeight: '700',
  },
  accountBannerValue: { color: '#fff', marginTop: 6, fontWeight: '600' },
  warnBanner: {
    backgroundColor: '#fff4d6',
    borderColor: '#f0c56b',
    borderWidth: 1,
    borderRadius: 16,
    padding: 14,
    marginBottom: 16,
  },
  warnText: { color: '#8a6400', fontWeight: '600' },
  quoteCard: {
    backgroundColor: '#fff',
    borderRadius: 18,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#e7ece8',
  },
  sectionTitle: { fontSize: 18, fontWeight: '800', color: '#12372a', marginBottom: 8 },
  helperText: { color: '#60756b', fontSize: 13, lineHeight: 18, marginTop: 8 },
  row: { flexDirection: 'row', gap: 10 },
  input: {
    flex: 1,
    backgroundColor: '#f6f8f7',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: '#173428',
    borderWidth: 1,
    borderColor: '#e4ebe6',
  },
  activeCard: {
    backgroundColor: '#e8f5e9',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#c8e6c9',
  },
  activeTitle: {
    fontSize: 12,
    color: '#2e7d32',
    fontWeight: '700',
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  activePlan: { fontSize: 18, fontWeight: '800', color: '#111', marginBottom: 4 },
  activePeriod: { fontSize: 13, color: '#555' },
  cancelNotice: { fontSize: 13, color: '#e53935', marginTop: 6 },
  planCard: {
    backgroundColor: '#fff',
    borderRadius: 18,
    padding: 16,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#e0e5e1',
  },
  planCardActive: { borderColor: '#0f766e', borderWidth: 2 },
  planName: { fontSize: 20, fontWeight: '800', color: '#12372a', marginBottom: 4 },
  planDescription: { fontSize: 13, color: '#60756b', marginBottom: 10 },
  planPrice: { fontSize: 28, fontWeight: '800', color: '#12372a' },
  planPricePer: { fontSize: 14, fontWeight: '500', color: '#60756b' },
  savingsLabel: {
    fontSize: 12,
    color: '#2e7d32',
    fontWeight: '700',
    marginTop: 2,
    marginBottom: 8,
  },
  featureList: { marginTop: 12, marginBottom: 16 },
  featureItem: { fontSize: 13, color: '#344b42', marginBottom: 6 },
  subscribeButton: {
    backgroundColor: '#0f766e',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  subscribeButtonDisabled: { opacity: 0.7 },
  subscribeButtonText: { color: '#fff', fontWeight: '800', fontSize: 15 },
  quoteLine: { color: '#314941', marginBottom: 6, fontWeight: '600' },
  fallbackText: {
    color: '#8a6400',
    backgroundColor: '#fff4d6',
    borderRadius: 10,
    padding: 10,
    marginTop: 8,
    fontWeight: '600',
  },
  auditTitle: { fontSize: 14, fontWeight: '800', color: '#12372a', marginTop: 12, marginBottom: 8 },
  auditBlock: {
    backgroundColor: '#f8fbf9',
    borderRadius: 14,
    padding: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#e7ece8',
  },
  auditLine: { color: '#344b42', marginBottom: 4, fontSize: 12 },
  confirmButton: {
    backgroundColor: '#12372a',
    borderRadius: 14,
    alignItems: 'center',
    paddingVertical: 14,
    marginTop: 14,
  },
  confirmButtonDisabled: { opacity: 0.8 },
  confirmButtonText: { color: '#fff', fontWeight: '800' },
});

export default PaymentScreen;
