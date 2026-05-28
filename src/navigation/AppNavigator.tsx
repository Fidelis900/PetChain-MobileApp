import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { NavigationContainer, type LinkingOptions } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import React from 'react';
import { StatusBar } from 'react-native';

import { useNavigationTheme } from '../theme';
import type { RootStackParamList, MainTabParamList, PetStackParamList } from './types';
import { DEEP_LINK_PREFIX } from './types';
import type { Pet } from '../models/Pet';
import AppointmentScreen from '../screens/AppointmentScreen';
import AuthNavigator from '../screens/AuthNavigator';
import CommunityScreen from '../screens/CommunityScreen';
import DeleteAccountScreen from '../screens/DeleteAccountScreen';
import EmergencyContactsScreen from '../screens/EmergencyContactsScreen';
import ManualEntryScreen from '../screens/ManualEntryScreen';
import MedicalRecordSearchScreen from '../screens/MedicalRecordSearchScreen';
import MedicalRecordViewerScreen from '../screens/MedicalRecordViewerScreen';
import MedicationScreen from '../screens/MedicationScreen';
import NearbyVetScreen from '../screens/NearbyVetScreen';
import NotificationPreferencesScreen from '../screens/NotificationPreferencesScreen';
import OnboardingScreen from '../screens/OnboardingScreen';
import PaymentScreen from '../screens/PaymentScreen';
import PetDetailScreen from '../screens/PetDetailScreen';
import PetFormScreen from '../screens/PetFormScreen';
import PetHealthDashboardScreen from '../screens/PetHealthDashboardScreen';
import PetHealthMetricsScreen from '../screens/PetHealthMetricsScreen';
import PetListScreen from '../screens/PetListScreen';
import PetShareScreen from '../screens/PetShareScreen';
import ProfileScreen from '../screens/ProfileScreen';
import QRScannerScreen from '../screens/QRScannerScreen';
import ForumScreen from '../screens/ForumScreen';
import analyticsService from '../services/analyticsService';

const RootStack = createNativeStackNavigator<RootStackParamList>();
const Tab = createBottomTabNavigator<MainTabParamList>();
const PetStack = createNativeStackNavigator<PetStackParamList>();

// ─── Pet Stack ────────────────────────────────────────────────────────────────
function PetNavigator() {
  return (
    <PetStack.Navigator>
      <PetStack.Screen name="PetListScreen" options={{ title: 'My Pets' }}>
        {({ navigation }) => (
          <PetListScreen
            onSelectPet={(pet) => navigation.navigate('PetDetail', { petId: pet.id })}
            onAddPet={() => navigation.navigate('PetForm', {})}
          />
        )}
      </PetStack.Screen>
      <PetStack.Screen name="PetDetail" options={{ title: 'Pet Details' }}>
        {({ route, navigation }) => (
          <PetDetailScreen
            petId={route.params.petId}
            onBack={() => navigation.goBack()}
            onEdit={(pet: Pet) => navigation.navigate('PetForm', { pet })}
            onHealthDashboard={(petId, petName) =>
              navigation.navigate('PetHealthDashboard', { petId, petName })
            }
            onShare={(petId, petName) => navigation.navigate('PetShare', { petId, petName })}
          />
        )}
      </PetStack.Screen>
      <PetStack.Screen name="PetHealthDashboard" options={{ title: 'Health Dashboard' }}>
        {({ route, navigation }) => (
          <PetHealthDashboardScreen
            petId={route.params.petId}
            petName={route.params.petName ?? 'Pet'}
            onBack={() => navigation.goBack()}
            onOpenMetrics={() =>
              navigation.navigate('PetHealthMetrics', {
                petId: route.params.petId,
                petName: route.params.petName,
              })
            }
          />
        )}
      </PetStack.Screen>
      <PetStack.Screen name="PetHealthMetrics" options={{ title: 'Health metrics' }}>
        {({ route, navigation }) => (
          <PetHealthMetricsScreen
            petId={route.params.petId}
            petName={route.params.petName ?? 'Pet'}
            onBack={() => navigation.goBack()}
          />
        )}
      </PetStack.Screen>
      <PetStack.Screen name="PetForm" options={{ title: 'Pet Form' }}>
        {({ route, navigation }) => (
          <PetFormScreen
            pet={route.params?.pet}
            ownerId={route.params?.ownerId}
            onBack={() => navigation.goBack()}
            onSaved={() => navigation.goBack()}
          />
        )}
      </PetStack.Screen>
      <PetStack.Screen name="MedicalRecordSearch" options={{ title: 'Search Records' }}>
        {({ route, navigation }) => (
          <MedicalRecordSearchScreen
            petId={route.params.petId}
            onBack={() => navigation.goBack()}
          />
        )}
      </PetStack.Screen>
      <PetStack.Screen name="MedicalRecordViewer" options={{ title: 'Medical Records' }}>
        {({ route, navigation }) => (
          <MedicalRecordViewerScreen
            petId={route.params.petId}
            petName={route.params.petName}
            onBack={() => navigation.goBack()}
          />
        )}
      </PetStack.Screen>
      <PetStack.Screen name="PetShare" options={{ title: 'Share Pet Profile' }}>
        {({ route, navigation }) => (
          <PetShareScreen
            petId={route.params.petId}
            petName={route.params.petName}
            onBack={() => navigation.goBack()}
          />
        )}
      </PetStack.Screen>
      <PetStack.Screen name="NearbyVet" options={{ title: 'Nearby Vet Clinics' }}>
        {({ navigation }) => <NearbyVetScreen onBack={() => navigation.goBack()} />}
      </PetStack.Screen>
      <PetStack.Screen
        name="NotificationPreferences"
        options={{ title: 'Notification Preferences' }}
      >
        {({ navigation }) => <NotificationPreferencesScreen onBack={() => navigation.goBack()} />}
      </PetStack.Screen>
      <PetStack.Screen name="DeleteAccount" options={{ title: 'Delete Account' }}>
        {({ navigation }) => (
          <DeleteAccountScreen
            onBack={() => navigation.goBack()}
            onDeleted={() =>
              navigation
                .getParent()
                ?.getParent()
                ?.reset({ index: 0, routes: [{ name: 'Auth' }] })
            }
          />
        )}
      </PetStack.Screen>
    </PetStack.Navigator>
  );
}

// ─── Main Tabs ────────────────────────────────────────────────────────────────
function MainTabs() {
  return (
    <Tab.Navigator>
      <Tab.Screen
        name="PetList"
        component={PetNavigator}
        options={{ title: 'Pets', headerShown: false }}
      />
      <Tab.Screen
        name="Medications"
        component={MedicationScreen}
        options={{ title: 'Medications' }}
      />
      <Tab.Screen
        name="Appointments"
        component={AppointmentScreen}
        options={{ title: 'Appointments' }}
      />
      <Tab.Screen name="Community" component={CommunityScreen} options={{ title: 'Community' }} />
      <Tab.Screen
        name="Emergency"
        component={EmergencyContactsScreen}
        options={{ title: 'Emergency' }}
      />
      <Tab.Screen name="Profile" component={ProfileScreen} options={{ title: 'Profile' }} />
    </Tab.Navigator>
  );
}

// ─── Deep linking ─────────────────────────────────────────────────────────────
const linking: LinkingOptions<RootStackParamList> = {
  prefixes: DEEP_LINK_PREFIX,
  config: {
    screens: {
      Onboarding: 'onboarding',
      Auth: 'auth',
      Main: {
        screens: {
          PetList: {
            screens: {
              PetListScreen: 'pets',
              PetDetail: 'pets/:petId',
              PetHealthDashboard: 'pets/:petId/dashboard',
              PetHealthMetrics: 'pets/:petId/health',
              PetForm: 'pets/form/:petId?',
              PetShare: 'pets/:petId/share',
              NearbyVet: 'nearby-vets',
            },
          },
          Medications: 'medications',
          Appointments: 'appointments',
          Community: 'community',
          Emergency: 'emergency',
          Profile: 'profile',
        },
      },
      QRScanner: 'scan',
      ManualEntry: 'manual-entry',
      Payment: 'payment',
    },
  },
};

// ─── Root Navigator ───────────────────────────────────────────────────────────
export default function AppNavigator() {
  const navRef = React.useRef<
    Parameters<typeof NavigationContainer>[0] & {
      getCurrentRoute?: () => { name?: string } | undefined;
    }
  >(null);

  const navTheme = useNavigationTheme();

  return (
    <>
      <StatusBar
        barStyle={navTheme.dark ? 'light-content' : 'dark-content'}
        backgroundColor={navTheme.colors.card}
      />
      <NavigationContainer
        ref={navRef as React.Ref<never>}
        theme={navTheme}
        linking={linking}
        onStateChange={() => {
          const route = (
            navRef.current as { getCurrentRoute?: () => { name?: string } | undefined } | null
          )?.getCurrentRoute?.();
          if (route?.name) analyticsService.screenView(route.name);
        }}
      >
        <RootStack.Navigator screenOptions={{ headerShown: false }}>
          <RootStack.Screen name="Onboarding">
            {({ navigation }) => (
              <OnboardingScreen
                onComplete={() => navigation.replace('Auth')}
                onSkip={() => navigation.replace('Auth')}
              />
            )}
          </RootStack.Screen>

          <RootStack.Screen name="Auth">
            {({ navigation }) => (
              <AuthNavigator onAuthenticated={() => navigation.replace('Main')} />
            )}
          </RootStack.Screen>

          <RootStack.Screen name="Main" component={MainTabs} />
          <RootStack.Screen
            name="Forum"
            component={ForumScreen}
            options={{ headerShown: true, title: 'Forum' }}
          />

          {/* Modals */}
          <RootStack.Group screenOptions={{ presentation: 'modal' }}>
            <RootStack.Screen name="QRScanner">
              {({ navigation }) => (
                <QRScannerScreen
                  onScanSuccess={() => navigation.goBack()}
                  onClose={() => navigation.goBack()}
                  onManualEntry={() => navigation.replace('ManualEntry')}
                />
              )}
            </RootStack.Screen>
            <RootStack.Screen name="ManualEntry">
              {({ navigation }) => (
                <ManualEntryScreen
                  onSubmit={() => navigation.goBack()}
                  onClose={() => navigation.goBack()}
                />
              )}
            </RootStack.Screen>
            <RootStack.Screen
              name="Payment"
              component={PaymentScreen}
              options={{ headerShown: true, title: 'Premium Plans' }}
            />
          </RootStack.Group>
        </RootStack.Navigator>
      </NavigationContainer>
    </>
  );
}
