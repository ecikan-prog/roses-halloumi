import { useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { trpc } from '../lib/trpc';
import type { SessionState } from '../../App';

// The backend still models this as a "staff" session (StaffUser/staffLogin/staffProcedure).
// Everything user-facing in this file must be presented as "Admin" only.

type AdminPage = 'overview' | 'orders' | 'products' | 'customers';

type OrderStatus = 'CONFIRMED' | 'FULFILLED' | 'CANCELLED';
type PaymentStatus = 'PAID' | 'OUTSTANDING' | 'OVERDUE';

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Please try again.';
}

function isSameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

export default function AdminDashboardScreen({
  session,
  onSignOut,
}: {
  session: SessionState;
  onSignOut: () => Promise<void>;
}) {
  const [page, setPage] = useState<AdminPage>('overview');
  const admin = session.user && session.user.kind === 'staff' ? session.user : null;

  const navItems: Array<{ label: string; value: AdminPage }> = [
    { label: 'Dashboard', value: 'overview' },
    { label: 'Orders', value: 'orders' },
    { label: 'Products', value: 'products' },
    { label: 'Customers', value: 'customers' },
  ];

  let content;
  switch (page) {
    case 'orders':
      content = <AdminOrdersPage />;
      break;
    case 'products':
      content = <AdminProductsPage />;
      break;
    case 'customers':
      content = <AdminCustomersPage />;
      break;
    case 'overview':
    default:
      content = <AdminOverviewPage onNavigate={setPage} />;
      break;
  }

  return (
    <View style={styles.screen}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.inner}>
          <View style={styles.headerBar}>
            <View>
              <Text style={styles.brand}>Grassland Cheese Admin</Text>
              <Text style={styles.brandSubtitle}>Business management dashboard</Text>
            </View>
            <View style={styles.headerActions}>
              {admin ? <Text style={styles.welcomeText}>{admin.name}</Text> : null}
              <Pressable style={styles.signOutButton} onPress={() => void onSignOut()}>
                <Text style={styles.signOutButtonText}>Sign out</Text>
              </Pressable>
            </View>
          </View>

          <View style={styles.navRow}>
            {navItems.map((item) => {
              const active = item.value === page;
              return (
                <Pressable
                  key={item.value}
                  style={[styles.navButton, active && styles.navButtonActive]}
                  onPress={() => setPage(item.value)}
                >
                  <Text style={[styles.navButtonText, active && styles.navButtonTextActive]}>{item.label}</Text>
                </Pressable>
              );
            })}
          </View>

          {content}
        </View>
      </ScrollView>
    </View>
  );
}

function AdminOverviewPage({ onNavigate }: { onNavigate: (page: AdminPage) => void }) {
  const ordersQuery = trpc.orders.list.useQuery(undefined);
  const orders = ordersQuery.data ?? [];

  const stats = useMemo(() => {
    const now = new Date();
    const todayOrders = orders.filter((order) => isSameDay(new Date(order.createdAt), now));
    const confirmed = orders.filter((order) => order.status === ('CONFIRMED' satisfies OrderStatus));
    const fulfilled = orders.filter((order) => order.status === ('FULFILLED' satisfies OrderStatus));
    const cancelled = orders.filter((order) => order.status === ('CANCELLED' satisfies OrderStatus));
    const totalSales = orders
      .filter((order) => order.status !== ('CANCELLED' satisfies OrderStatus))
      .reduce((sum, order) => sum + order.total, 0);

    return {
      todayCount: todayOrders.length,
      confirmedCount: confirmed.length,
      fulfilledCount: fulfilled.length,
      cancelledCount: cancelled.length,
      totalSales,
    };
  }, [orders]);

  const recentOrders = orders.slice(0, 8);

  return (
    <View style={styles.pageWrap}>
      <Text style={styles.pageTitle}>Dashboard</Text>
      <Text style={styles.pageDescription}>Overview of shop activity across all Grassland Cheese orders.</Text>

      {ordersQuery.isLoading ? <Text style={styles.metaText}>Loading dashboard…</Text> : null}
      {ordersQuery.isError ? <Text style={styles.errorText}>{getErrorMessage(ordersQuery.error)}</Text> : null}

      <View style={styles.statsGrid}>
        <StatCard label="Today's Orders" value={String(stats.todayCount)} />
        <StatCard label="Confirmed Orders" value={String(stats.confirmedCount)} />
        <StatCard label="Fulfilled Orders" value={String(stats.fulfilledCount)} />
        <StatCard label="Cancelled Orders" value={String(stats.cancelledCount)} />
        <StatCard label="Total Sales" value={`$${stats.totalSales.toFixed(2)}`} accent />
      </View>

      <View style={styles.card}>
        <View style={styles.cardHeaderRow}>
          <Text style={styles.cardTitle}>Recent Orders</Text>
          <Pressable onPress={() => onNavigate('orders')}>
            <Text style={styles.linkText}>View all orders</Text>
          </Pressable>
        </View>

        {recentOrders.length === 0 && !ordersQuery.isLoading ? (
          <Text style={styles.metaText}>No orders yet.</Text>
        ) : null}

        {recentOrders.map((order) => (
          <View key={order.id} style={styles.recentOrderRow}>
            <View style={styles.recentOrderMain}>
              <Text style={styles.recentOrderNumber}>{order.orderNumber ?? `#${order.id}`}</Text>
              <Text style={styles.metaText}>{order.customer.name}</Text>
            </View>
            <View style={styles.recentOrderMeta}>
              <Text style={styles.metaText}>{new Date(order.createdAt).toLocaleDateString()}</Text>
              <Text style={styles.metaText}>${order.total.toFixed(2)}</Text>
            </View>
            <View style={styles.recentOrderMeta}>
              <StatusPill label={order.status} />
              <StatusPill label={order.paymentStatus} />
            </View>
          </View>
        ))}
      </View>
    </View>
  );
}

function StatCard({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <View style={[styles.statCard, accent && styles.statCardAccent]}>
      <Text style={[styles.statValue, accent && styles.statValueAccent]}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function StatusPill({ label }: { label: string }) {
  return (
    <View style={styles.statusPill}>
      <Text style={styles.statusPillText}>{label.replace('_', ' ')}</Text>
    </View>
  );
}

const paymentStatusFilterOptions: Array<{ label: string; value: PaymentStatus | 'ALL' }> = [
  { label: 'All', value: 'ALL' },
  { label: 'Paid', value: 'PAID' },
  { label: 'Outstanding', value: 'OUTSTANDING' },
  { label: 'Overdue', value: 'OVERDUE' },
];

function AdminOrdersPage() {
  const [statusFilter, setStatusFilter] = useState<PaymentStatus | 'ALL'>('ALL');
  const ordersQuery = trpc.orders.list.useQuery(statusFilter === 'ALL' ? undefined : { paymentStatus: statusFilter });
  const orders = ordersQuery.data ?? [];

  return (
    <View style={styles.pageWrap}>
      <Text style={styles.pageTitle}>Orders</Text>
      <Text style={styles.pageDescription}>Search and review every customer order, its items, and delivery details.</Text>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Filter by payment status</Text>
        <View style={styles.filterRow}>
          {paymentStatusFilterOptions.map((option) => {
            const active = option.value === statusFilter;
            return (
              <Pressable
                key={option.value}
                style={[styles.filterChip, active && styles.filterChipActive]}
                onPress={() => setStatusFilter(option.value)}
              >
                <Text style={[styles.filterChipText, active && styles.filterChipTextActive]}>{option.label}</Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      {ordersQuery.isLoading ? <Text style={styles.metaText}>Loading orders…</Text> : null}
      {ordersQuery.isError ? <Text style={styles.errorText}>{getErrorMessage(ordersQuery.error)}</Text> : null}
      {orders.length === 0 && !ordersQuery.isLoading ? <Text style={styles.metaText}>No orders match this filter.</Text> : null}

      {orders.map((order) => (
        <View key={order.id} style={styles.card}>
          <View style={styles.cardHeaderRow}>
            <Text style={styles.cardTitle}>{order.orderNumber ?? `#${order.id}`}</Text>
            <View style={styles.recentOrderMeta}>
              <StatusPill label={order.status} />
              <StatusPill label={order.paymentStatus} />
            </View>
          </View>
          <Text style={styles.metaText}>{new Date(order.createdAt).toLocaleString()}</Text>
          <Text style={styles.metaText}>Customer: {order.customer.name} ({order.customer.type})</Text>
          {order.deliveryAddress ? <Text style={styles.metaText}>Deliver to: {order.deliveryAddress}</Text> : null}
          {order.orderNotes ? <Text style={styles.metaText}>Notes: {order.orderNotes}</Text> : null}

          <View style={styles.itemsList}>
            {order.items.map((item) => (
              <Text key={item.id} style={styles.metaText}>
                {item.qty} × {item.product.name} @ ${item.unitPrice.toFixed(2)}
              </Text>
            ))}
          </View>

          <View style={styles.totalsRow}>
            <Text style={styles.metaText}>Subtotal: ${(order.subtotal ?? 0).toFixed(2)}</Text>
            <Text style={styles.metaText}>Delivery: ${order.deliveryCharge.toFixed(2)}</Text>
            <Text style={styles.metaText}>Discount: ${order.discountApplied.toFixed(2)}</Text>
            <Text style={styles.cardTitle}>Total: ${order.total.toFixed(2)}</Text>
          </View>
        </View>
      ))}
    </View>
  );
}

function AdminProductsPage() {
  return (
    <View style={styles.pageWrap}>
      <Text style={styles.pageTitle}>Products</Text>
      <Text style={styles.pageDescription}>Product management is coming soon in a future update.</Text>
      <View style={styles.card}>
        <Text style={styles.metaText}>
          This section will let you view and edit Grassland Cheese Halloumi products (1kg, 500g, 200g), pricing, availability,
          and images.
        </Text>
      </View>
    </View>
  );
}

function AdminCustomersPage() {
  const utils = trpc.useUtils();
  const customersQuery = trpc.staff.listCustomers.useQuery();
  const updateCustomerType = trpc.staff.updateCustomerType.useMutation({
    onSuccess: async () => {
      await utils.staff.listCustomers.invalidate();
    },
  });

  async function toggleTier(customerId: number, nextType: 'WHOLESALE' | 'RETAIL') {
    try {
      await updateCustomerType.mutateAsync({ customerId, type: nextType });
    } catch (error) {
      Alert.alert('Unable to update tier', getErrorMessage(error));
    }
  }

  return (
    <View style={styles.pageWrap}>
      <Text style={styles.pageTitle}>Customers</Text>
      <Text style={styles.pageDescription}>
        View registered customers and set each customer's Retail/Wholesale tier. Customers manage their own name, email, and password.
      </Text>

      {customersQuery.isLoading ? <Text style={styles.metaText}>Loading customers…</Text> : null}
      {customersQuery.isError ? <Text style={styles.errorText}>{getErrorMessage(customersQuery.error)}</Text> : null}

      {(customersQuery.data ?? []).map((customer) => (
        <View key={customer.id} style={styles.card}>
          <Text style={styles.cardTitle}>{customer.name}</Text>
          <Text style={styles.metaText}>{customer.email}</Text>
          <Text style={styles.metaText}>Mobile: {customer.contact || 'Not recorded'}</Text>
          <Text style={styles.metaText}>{customer.type} • {customer.accountSource.replace('_', ' ')}</Text>
          <Pressable
            style={styles.secondaryButton}
            onPress={() => void toggleTier(customer.id, customer.type === 'WHOLESALE' ? 'RETAIL' : 'WHOLESALE')}
          >
            <Text style={styles.secondaryButtonText}>
              Set {customer.type === 'WHOLESALE' ? 'retail' : 'wholesale'}
            </Text>
          </Pressable>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#f1f4f2',
  },
  scrollContent: {
    paddingBottom: 48,
  },
  inner: {
    width: '100%',
    maxWidth: 1180,
    alignSelf: 'center',
    paddingHorizontal: 20,
    paddingTop: 24,
    gap: 20,
  },
  headerBar: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#123524',
    borderRadius: 20,
    paddingVertical: 20,
    paddingHorizontal: 24,
  },
  brand: {
    fontSize: 24,
    fontWeight: '700',
    color: '#fffef8',
  },
  brandSubtitle: {
    fontSize: 13,
    color: '#c9d8ce',
    marginTop: 2,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  welcomeText: {
    color: '#fffef8',
    fontWeight: '600',
  },
  signOutButton: {
    borderRadius: 999,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: '#fffef8',
  },
  signOutButtonText: {
    color: '#fffef8',
    fontWeight: '700',
  },
  navRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  navButton: {
    borderRadius: 12,
    paddingHorizontal: 18,
    paddingVertical: 12,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#dbe3de',
  },
  navButtonActive: {
    backgroundColor: '#1f5c43',
    borderColor: '#1f5c43',
  },
  navButtonText: {
    color: '#224232',
    fontWeight: '600',
  },
  navButtonTextActive: {
    color: '#fffef8',
  },
  pageWrap: {
    gap: 16,
  },
  pageTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#123524',
  },
  pageDescription: {
    fontSize: 14,
    color: '#4d5f55',
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 14,
  },
  statCard: {
    flexGrow: 1,
    minWidth: 150,
    backgroundColor: '#ffffff',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#dbe3de',
    paddingVertical: 18,
    paddingHorizontal: 18,
    gap: 6,
  },
  statCardAccent: {
    backgroundColor: '#1f5c43',
    borderColor: '#1f5c43',
  },
  statValue: {
    fontSize: 26,
    fontWeight: '700',
    color: '#123524',
  },
  statValueAccent: {
    color: '#fffef8',
  },
  statLabel: {
    fontSize: 13,
    color: '#5a6d61',
    fontWeight: '600',
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#dbe3de',
    padding: 18,
    gap: 10,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#123524',
  },
  linkText: {
    color: '#1f5c43',
    fontWeight: '700',
  },
  metaText: {
    fontSize: 13,
    color: '#5a6d61',
  },
  errorText: {
    fontSize: 13,
    color: '#b3261e',
  },
  recentOrderRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: '#eef1ef',
  },
  recentOrderMain: {
    minWidth: 140,
    gap: 2,
  },
  recentOrderNumber: {
    fontWeight: '700',
    color: '#123524',
  },
  recentOrderMeta: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
  },
  statusPill: {
    backgroundColor: '#eef1ef',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  statusPillText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#224232',
  },
  filterRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  filterChip: {
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: '#f1f4f2',
  },
  filterChipActive: {
    backgroundColor: '#1f5c43',
  },
  filterChipText: {
    color: '#224232',
    fontWeight: '600',
  },
  filterChipTextActive: {
    color: '#fffef8',
  },
  itemsList: {
    gap: 2,
  },
  totalsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 14,
    alignItems: 'center',
  },
  fieldWrap: {
    gap: 6,
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#123524',
  },
  input: {
    borderWidth: 1,
    borderColor: '#dbe3de',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
  },
  inputError: {
    borderColor: '#b3261e',
  },
  fieldErrorText: {
    fontSize: 12,
    color: '#b3261e',
  },
  primaryButton: {
    backgroundColor: '#1f5c43',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  primaryButtonText: {
    color: '#fffef8',
    fontWeight: '700',
  },
  secondaryButton: {
    borderWidth: 1,
    borderColor: '#1f5c43',
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: 14,
  },
  secondaryButtonText: {
    color: '#1f5c43',
    fontWeight: '700',
  },
});
