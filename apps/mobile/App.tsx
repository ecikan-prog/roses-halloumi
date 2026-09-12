import { useEffect, useMemo, useState, type Dispatch, type SetStateAction } from 'react';
import { ActivityIndicator, Alert, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { StatusBar } from 'expo-status-bar';
import { trpc, createApiClient } from './src/lib/trpc';
import { clearStoredToken, getStoredToken, setStoredToken } from './src/lib/session';

const PaymentTerm = {
  PAY_NOW: 'PAY_NOW',
  PAY_30: 'PAY_30',
} as const;

type PaymentTerm = (typeof PaymentTerm)[keyof typeof PaymentTerm];

const PaymentMethod = {
  IN_APP: 'IN_APP',
  EFTPOS: 'EFTPOS',
} as const;

type PaymentMethod = (typeof PaymentMethod)[keyof typeof PaymentMethod];

const PaymentStatus = {
  PAID: 'PAID',
  OUTSTANDING: 'OUTSTANDING',
  OVERDUE: 'OVERDUE',
} as const;

type PaymentStatus = (typeof PaymentStatus)[keyof typeof PaymentStatus];

type CustomerUser = {
  kind: 'customer';
  id: number;
  name: string;
  email: string;
  type: 'WHOLESALE' | 'RETAIL';
  contact: string | null;
};

type StaffUser = {
  kind: 'staff';
  id: number;
  name: string;
  email: string;
  role: 'STAFF' | 'ADMIN';
};

type SessionUser = CustomerUser | StaffUser;
type AuthMode = 'customer-login' | 'staff-login' | 'customer-register';
type AppTab = 'catalog' | 'orders' | 'customers';

type SessionState = {
  token: string | null;
  user: SessionUser | null;
};

type ProductRecord = {
  id: number;
  name: string;
  unit: string;
  active: boolean;
  wholesalePrice: number;
  retailPrice: number;
  effectivePrice: number;
  customerType: 'WHOLESALE' | 'RETAIL';
};

const paymentStatusOptions: Array<PaymentStatus | 'ALL'> = ['ALL', PaymentStatus.PAID, PaymentStatus.OUTSTANDING, PaymentStatus.OVERDUE];

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Please try again.';
}

function AppContent({
  hydrated,
  queryClient,
  session,
  setSession,
}: {
  hydrated: boolean;
  queryClient: QueryClient;
  session: SessionState;
  setSession: Dispatch<SetStateAction<SessionState>>;
}) {
  const meQuery = trpc.auth.me.useQuery(undefined, {
    enabled: Boolean(session.token),
    retry: false,
  });

  useEffect(() => {
    if (meQuery.data) {
      setSession((current) => ({ ...current, user: meQuery.data as SessionUser }));
    }
  }, [meQuery.data, setSession]);

  useEffect(() => {
    if (!meQuery.error) {
      return;
    }

    void clearStoredToken();
    setSession({ token: null, user: null });
    queryClient.clear();
  }, [meQuery.error, queryClient, setSession]);

  async function handleAuthenticated(nextToken: string, user: SessionUser) {
    await setStoredToken(nextToken);
    setSession({ token: nextToken, user });
  }

  async function handleSignOut() {
    await clearStoredToken();
    setSession({ token: null, user: null });
    queryClient.clear();
  }

  if (!hydrated) {
    return (
      <SafeAreaView style={styles.centeredScreen}>
        <ActivityIndicator size="large" color="#00695c" />
      </SafeAreaView>
    );
  }

  if (session.token && !session.user && meQuery.isLoading) {
    return (
      <SafeAreaView style={styles.centeredScreen}>
        <ActivityIndicator size="large" color="#00695c" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="dark" />
      {session.token && session.user ? <Dashboard session={session} onSignOut={handleSignOut} /> : <AuthScreen onAuthenticated={handleAuthenticated} />}
    </SafeAreaView>
  );
}

function AuthScreen({ onAuthenticated }: { onAuthenticated: (token: string, user: SessionUser) => Promise<void> }) {
  const [mode, setMode] = useState<AuthMode>('customer-login');
  const [name, setName] = useState('');
  const [contact, setContact] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('password123');

  const customerLogin = trpc.auth.customerLogin.useMutation();
  const staffLogin = trpc.auth.staffLogin.useMutation();
  const customerRegister = trpc.auth.customerRegister.useMutation();

  const loading = customerLogin.isPending || staffLogin.isPending || customerRegister.isPending;

  async function submit() {
    try {
      if (mode === 'customer-register') {
        const result = await customerRegister.mutateAsync({
          name,
          contact: contact.trim() || undefined,
          email,
          password,
        });
        await onAuthenticated(result.token, result.user as SessionUser);
      } else if (mode === 'customer-login') {
        const result = await customerLogin.mutateAsync({ email, password });
        await onAuthenticated(result.token, result.user as SessionUser);
      } else {
        const result = await staffLogin.mutateAsync({ email, password });
        await onAuthenticated(result.token, result.user as SessionUser);
      }
    } catch (error) {
      Alert.alert('Authentication failed', getErrorMessage(error));
    }
  }

  return (
    <ScrollView contentContainerStyle={styles.authContainer}>
      <Text style={styles.appTitle}>Dairy Sales</Text>
      <Text style={styles.subtitle}>Order entry for dairy staff and customers</Text>
      <SegmentedControl
        groupLabel="Authentication mode"
        value={mode}
        options={[
          { label: 'Customer', value: 'customer-login' },
          { label: 'Staff', value: 'staff-login' },
          { label: 'Register', value: 'customer-register' },
        ]}
        onChange={(value) => setMode(value as AuthMode)}
      />
      {mode === 'customer-register' ? (
        <>
          <Field label="Business / account name" value={name} onChangeText={setName} />
          <Field label="Contact" value={contact} onChangeText={setContact} />
        </>
      ) : null}
      <Field label="Email" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" />
      <Field label="Password" value={password} onChangeText={setPassword} secureTextEntry />
      <Pressable disabled={loading} style={styles.primaryButton} onPress={() => void submit()}>
        <Text style={styles.primaryButtonLabel}>{loading ? 'Please wait…' : mode === 'customer-register' ? 'Create retail account' : 'Sign in'}</Text>
      </Pressable>
      <View style={styles.credentialsPanel}>
        <Text style={styles.credentialsTitle}>Seed accounts</Text>
        <Text style={styles.credentialsText}>admin@dairysales.local / password123</Text>
        <Text style={styles.credentialsText}>staff@dairysales.local / password123</Text>
        <Text style={styles.credentialsText}>wholesale@dairysales.local / password123</Text>
        <Text style={styles.credentialsText}>retail@dairysales.local / password123</Text>
      </View>
    </ScrollView>
  );
}

function Dashboard({ session, onSignOut }: { session: SessionState; onSignOut: () => Promise<void> }) {
  const [tab, setTab] = useState<AppTab>('catalog');
  const isStaff = session.user?.kind === 'staff';

  return (
    <View style={styles.dashboard}>
      <View style={styles.header}>
        <View>
          <Text style={styles.welcomeText}>Signed in as {session.user?.name}</Text>
          <Text style={styles.metaText}>
            {session.user?.kind === 'staff' ? `${session.user.role} staff account` : `${session.user?.type} pricing`}
          </Text>
        </View>
        <Pressable style={styles.secondaryButton} onPress={() => void onSignOut()}>
          <Text style={styles.secondaryButtonLabel}>Sign out</Text>
        </Pressable>
      </View>
      <SegmentedControl
        groupLabel="Main navigation"
        value={tab}
        options={[
          { label: 'Catalog', value: 'catalog' },
          { label: 'Orders', value: 'orders' },
          ...(isStaff ? [{ label: 'Customers', value: 'customers' }] : []),
        ]}
        onChange={(value) => setTab(value as AppTab)}
      />
      {tab === 'catalog' ? <CatalogScreen session={session} /> : null}
      {tab === 'orders' ? <OrdersScreen /> : null}
      {tab === 'customers' && isStaff ? <CustomersScreen /> : null}
    </View>
  );
}

function CatalogScreen({ session }: { session: SessionState }) {
  const [selectedCustomerId, setSelectedCustomerId] = useState<number | undefined>(session.user?.kind === 'customer' ? session.user.id : undefined);
  const [paymentTerm, setPaymentTerm] = useState<PaymentTerm>(PaymentTerm.PAY_NOW);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>(PaymentMethod.IN_APP);
  const [quantities, setQuantities] = useState<Record<number, number>>({});
  const effectiveCustomerId = session.user?.kind === 'customer' ? session.user.id : selectedCustomerId;
  const customerQuery = trpc.staff.listCustomers.useQuery(undefined, { enabled: session.user?.kind === 'staff' });
  const productsQuery = trpc.catalog.listProducts.useQuery(
    session.user?.kind === 'staff' ? { customerId: effectiveCustomerId } : undefined,
    { enabled: session.user?.kind === 'customer' || Boolean(effectiveCustomerId) },
  );
  const createOrder = trpc.orders.create.useMutation();
  const utils = trpc.useUtils();

  useEffect(() => {
    if (session.user?.kind === 'customer') {
      setSelectedCustomerId(session.user.id);
    }
  }, [session.user]);

  const selectedItems = ((productsQuery.data ?? []) as ProductRecord[])
    .filter((product) => quantities[product.id] > 0)
    .map((product) => ({ ...product, qty: quantities[product.id] }));
  const subtotal = selectedItems.reduce((sum, item) => sum + item.qty * item.effectivePrice, 0);
  const discount = paymentTerm === PaymentTerm.PAY_NOW ? subtotal * 0.1 : 0;
  const total = subtotal - discount;

  async function submitOrder() {
    if (!selectedItems.length) {
      Alert.alert('Add items', 'Choose at least one product before confirming the order.');
      return;
    }

    if (session.user?.kind === 'staff' && !effectiveCustomerId) {
      Alert.alert('Choose customer', 'Select a customer before creating a staff order.');
      return;
    }

    try {
      await createOrder.mutateAsync({
        customerId: session.user?.kind === 'staff' ? effectiveCustomerId : undefined,
        paymentTerm,
        ...(paymentTerm === PaymentTerm.PAY_NOW ? { paymentMethod } : {}),
        items: selectedItems.map((item) => ({ productId: item.id, qty: item.qty })),
      });
      await Promise.all([utils.orders.list.invalidate(), utils.catalog.listProducts.invalidate()]);
      setQuantities({});
      Alert.alert('Order confirmed', paymentTerm === PaymentTerm.PAY_NOW ? 'Discount applied and payment marked as paid.' : 'Order saved with 30 day terms.');
    } catch (error) {
      Alert.alert('Order failed', getErrorMessage(error));
    }
  }

  return (
    <ScrollView style={styles.tabBody} contentContainerStyle={styles.contentContainer}>
      {session.user?.kind === 'staff' ? (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Order for customer</Text>
          {customerQuery.isLoading ? <Text style={styles.metaText}>Loading customers…</Text> : null}
          {(customerQuery.data?.length ?? 0) > 0 ? (
            <SegmentedControl
              groupLabel="Select customer"
              value={String(effectiveCustomerId ?? '')}
              options={(customerQuery.data ?? []).map((customer) => ({
                label: `${customer.name} (${customer.type})`,
                value: String(customer.id),
              }))}
              onChange={(value) => setSelectedCustomerId(Number(value))}
            />
          ) : null}
        </View>
      ) : null}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Payment terms</Text>
        <SegmentedControl
          groupLabel="Payment term"
          value={paymentTerm}
          options={[
            { label: 'Pay now (-10%)', value: PaymentTerm.PAY_NOW },
            { label: 'Pay in 30', value: PaymentTerm.PAY_30 },
          ]}
          onChange={(value) => setPaymentTerm(value as PaymentTerm)}
        />
        {paymentTerm === PaymentTerm.PAY_NOW ? (
          <SegmentedControl
            groupLabel="Payment method"
            value={paymentMethod}
            options={[
              { label: 'In-app placeholder', value: PaymentMethod.IN_APP },
              { label: 'Mark EFTPOS paid', value: PaymentMethod.EFTPOS },
            ]}
            onChange={(value) => setPaymentMethod(value as PaymentMethod)}
          />
        ) : (
          <Text style={styles.metaText}>Due date will be set to 30 days from confirmation.</Text>
        )}
      </View>
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Product catalog</Text>
        {productsQuery.isLoading ? <Text style={styles.metaText}>Loading products…</Text> : null}
        {(productsQuery.data ?? []).map((product) => (
          <View key={product.id} style={styles.productRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.productName}>{product.name}</Text>
              <Text style={styles.metaText}>
                {product.unit} • {product.customerType === 'WHOLESALE' ? 'Wholesale' : 'Retail'} ${product.effectivePrice.toFixed(2)}
              </Text>
            </View>
            <View style={styles.quantityRow}>
              <Pressable style={styles.quantityButton} onPress={() => setQuantities((current) => ({ ...current, [product.id]: Math.max((current[product.id] ?? 0) - 1, 0) }))}>
                <Text style={styles.quantityLabel}>-</Text>
              </Pressable>
              <Text style={styles.quantityValue}>{quantities[product.id] ?? 0}</Text>
              <Pressable style={styles.quantityButton} onPress={() => setQuantities((current) => ({ ...current, [product.id]: (current[product.id] ?? 0) + 1 }))}>
                <Text style={styles.quantityLabel}>+</Text>
              </Pressable>
            </View>
          </View>
        ))}
      </View>
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Cart summary</Text>
        <Text style={styles.summaryLine}>Subtotal: ${subtotal.toFixed(2)}</Text>
        <Text style={styles.summaryLine}>Discount: -${discount.toFixed(2)}</Text>
        <Text style={styles.summaryTotal}>Total: ${total.toFixed(2)}</Text>
        <Pressable style={styles.primaryButton} onPress={() => void submitOrder()}>
          <Text style={styles.primaryButtonLabel}>Confirm order</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}

function OrdersScreen() {
  const [statusFilter, setStatusFilter] = useState<PaymentStatus | 'ALL'>('ALL');
  const ordersQuery = trpc.orders.list.useQuery(statusFilter === 'ALL' ? undefined : { paymentStatus: statusFilter });

  return (
    <ScrollView style={styles.tabBody} contentContainerStyle={styles.contentContainer}>
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Payment status</Text>
        <SegmentedControl
          groupLabel="Payment status filter"
          value={statusFilter}
          options={paymentStatusOptions.map((status) => ({ label: status.replace('_', ' '), value: status }))}
          onChange={(value) => setStatusFilter(value as PaymentStatus | 'ALL')}
        />
      </View>
      {ordersQuery.isLoading ? <Text style={styles.metaText}>Loading orders…</Text> : null}
      {(ordersQuery.data ?? []).map((order) => (
        <View key={order.id} style={styles.card}>
          <Text style={styles.cardTitle}>Order #{order.id}</Text>
          <Text style={styles.metaText}>
            {order.customer.name} • {order.paymentStatus} • ${order.total.toFixed(2)}
          </Text>
          <Text style={styles.metaText}>
            {order.paymentTerm === PaymentTerm.PAY_NOW ? 'Pay now' : 'Pay in 30'} • {order.paymentMethod}
          </Text>
          {order.staff ? <Text style={styles.metaText}>Created by {order.staff.name}</Text> : null}
          {order.dueDate ? <Text style={styles.metaText}>Due {new Date(order.dueDate).toLocaleDateString()}</Text> : null}
          {order.items.map((item) => (
            <Text key={item.id} style={styles.orderItemText}>
              {item.qty} × {item.product.name} @ ${item.unitPrice.toFixed(2)}
            </Text>
          ))}
        </View>
      ))}
    </ScrollView>
  );
}

function CustomersScreen() {
  const utils = trpc.useUtils();
  const customersQuery = trpc.staff.listCustomers.useQuery();
  const createCustomer = trpc.staff.createCustomer.useMutation({
    onSuccess: async () => {
      await utils.staff.listCustomers.invalidate();
    },
  });
  const updateCustomerType = trpc.staff.updateCustomerType.useMutation({
    onSuccess: async () => {
      await utils.staff.listCustomers.invalidate();
    },
  });
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [contact, setContact] = useState('');
  const [password, setPassword] = useState('password123');
  const [type, setType] = useState<'WHOLESALE' | 'RETAIL'>('RETAIL');

  async function submit() {
    try {
      await createCustomer.mutateAsync({
        name,
        email,
        contact: contact.trim() || undefined,
        password,
        type,
      });
      setName('');
      setEmail('');
      setContact('');
      setPassword('password123');
      setType('RETAIL');
    } catch (error) {
      Alert.alert('Unable to create customer', getErrorMessage(error));
    }
  }

  async function toggleTier(customerId: number, nextType: 'WHOLESALE' | 'RETAIL') {
    try {
      await updateCustomerType.mutateAsync({ customerId, type: nextType });
    } catch (error) {
      Alert.alert('Unable to update tier', getErrorMessage(error));
    }
  }

  return (
    <ScrollView style={styles.tabBody} contentContainerStyle={styles.contentContainer}>
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Create customer account</Text>
        <Field label="Name" value={name} onChangeText={setName} />
        <Field label="Email" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" />
        <Field label="Contact" value={contact} onChangeText={setContact} />
        <Field label="Password" value={password} onChangeText={setPassword} secureTextEntry />
        <SegmentedControl
          groupLabel="Customer tier"
          value={type}
          options={[
            { label: 'Retail', value: 'RETAIL' },
            { label: 'Wholesale', value: 'WHOLESALE' },
          ]}
          onChange={(value) => setType(value as 'WHOLESALE' | 'RETAIL')}
        />
        <Pressable style={styles.primaryButton} onPress={() => void submit()}>
          <Text style={styles.primaryButtonLabel}>Create customer</Text>
        </Pressable>
      </View>
      {customersQuery.isLoading ? <Text style={styles.metaText}>Loading customers…</Text> : null}
      {(customersQuery.data ?? []).map((customer) => (
        <View key={customer.id} style={styles.card}>
          <Text style={styles.cardTitle}>{customer.name}</Text>
          <Text style={styles.metaText}>{customer.email}</Text>
          <Text style={styles.metaText}>
            {customer.type} • {customer.accountSource.replace('_', ' ')}
          </Text>
          <Text style={styles.metaText}>{customer.contact || 'No contact recorded'}</Text>
          <Pressable
            style={styles.secondaryButton}
            onPress={() => void toggleTier(customer.id, customer.type === 'WHOLESALE' ? 'RETAIL' : 'WHOLESALE')}
          >
            <Text style={styles.secondaryButtonLabel}>Set {customer.type === 'WHOLESALE' ? 'retail' : 'wholesale'}</Text>
          </Pressable>
        </View>
      ))}
    </ScrollView>
  );
}

function Field(props: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  secureTextEntry?: boolean;
  keyboardType?: 'default' | 'email-address';
  autoCapitalize?: 'none' | 'sentences';
}) {
  return (
    <View style={styles.fieldWrap}>
      <Text style={styles.fieldLabel}>{props.label}</Text>
      <TextInput
        autoCapitalize={props.autoCapitalize ?? 'sentences'}
        keyboardType={props.keyboardType ?? 'default'}
        secureTextEntry={props.secureTextEntry}
        style={styles.input}
        value={props.value}
        onChangeText={props.onChangeText}
      />
    </View>
  );
}

function SegmentedControl({
  groupLabel,
  options,
  value,
  onChange,
}: {
  groupLabel: string;
  options: Array<{ label: string; value: string }>;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <View accessibilityLabel={groupLabel} accessibilityRole="tablist" style={styles.segmentedControl}>
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <Pressable
            key={option.value}
            accessibilityLabel={option.label}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            style={[styles.segment, selected && styles.segmentSelected]}
            onPress={() => onChange(option.value)}
          >
            <Text style={[styles.segmentLabel, selected && styles.segmentLabelSelected]}>{option.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export default function App() {
  const [queryClient] = useState(() => new QueryClient());
  const [session, setSession] = useState<SessionState>({ token: null, user: null });
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    void (async () => {
      const token = await getStoredToken();
      setSession((current) => ({ ...current, token }));
      setHydrated(true);
    })();
  }, []);

  const trpcClient = useMemo(() => createApiClient(() => session.token), [session.token]);

  return (
    <trpc.Provider client={trpcClient} queryClient={queryClient}>
      <QueryClientProvider client={queryClient}>
        <AppContent hydrated={hydrated} queryClient={queryClient} session={session} setSession={setSession} />
      </QueryClientProvider>
    </trpc.Provider>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#f4f6f8',
  },
  centeredScreen: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f4f6f8',
  },
  authContainer: {
    padding: 24,
    gap: 16,
  },
  appTitle: {
    fontSize: 32,
    fontWeight: '700',
    color: '#1b4332',
  },
  subtitle: {
    fontSize: 16,
    color: '#52796f',
    marginBottom: 8,
  },
  dashboard: {
    flex: 1,
  },
  header: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  welcomeText: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1b4332',
  },
  metaText: {
    fontSize: 14,
    color: '#5c677d',
  },
  tabBody: {
    flex: 1,
  },
  contentContainer: {
    padding: 16,
    gap: 16,
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 16,
    gap: 12,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#081c15',
  },
  primaryButton: {
    backgroundColor: '#2d6a4f',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  primaryButtonLabel: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 16,
  },
  secondaryButton: {
    borderColor: '#2d6a4f',
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 14,
    alignItems: 'center',
  },
  secondaryButtonLabel: {
    color: '#2d6a4f',
    fontWeight: '700',
  },
  credentialsPanel: {
    borderRadius: 16,
    padding: 16,
    backgroundColor: '#d8f3dc',
    gap: 4,
  },
  credentialsTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1b4332',
  },
  credentialsText: {
    color: '#2d6a4f',
  },
  segmentedControl: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  segment: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#cad2c5',
    paddingVertical: 10,
    paddingHorizontal: 14,
    backgroundColor: '#fff',
  },
  segmentSelected: {
    backgroundColor: '#2d6a4f',
    borderColor: '#2d6a4f',
  },
  segmentLabel: {
    color: '#2f3e46',
    fontWeight: '600',
  },
  segmentLabelSelected: {
    color: '#fff',
  },
  fieldWrap: {
    gap: 8,
  },
  fieldLabel: {
    fontWeight: '600',
    color: '#344e41',
  },
  input: {
    backgroundColor: '#f8f9fa',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: '#dfe7e1',
  },
  productRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  productName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1b4332',
  },
  quantityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  quantityButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#d8f3dc',
    alignItems: 'center',
    justifyContent: 'center',
  },
  quantityLabel: {
    fontSize: 20,
    color: '#1b4332',
    fontWeight: '700',
  },
  quantityValue: {
    minWidth: 20,
    textAlign: 'center',
    fontWeight: '600',
  },
  summaryLine: {
    color: '#344e41',
    fontSize: 15,
  },
  summaryTotal: {
    color: '#081c15',
    fontSize: 18,
    fontWeight: '700',
  },
  orderItemText: {
    color: '#344e41',
  },
});
