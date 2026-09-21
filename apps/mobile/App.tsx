import { useEffect, useMemo, useState, type Dispatch, type ReactNode, type SetStateAction } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  ImageBackground,
  Linking,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
  type ImageSourcePropType,
} from 'react-native';
import { Asset } from 'expo-asset';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { StatusBar } from 'expo-status-bar';
import { trpc, createApiClient } from './src/lib/trpc';
import { clearStoredToken, getStoredToken, setStoredToken } from './src/lib/session';
import { clearStoredCart, getStoredCart, setStoredCart } from './src/lib/cart';
import AdminDashboardScreen from './src/admin/AdminDashboard';

const grasslandLogo = require('./assets/grassland-cheese-logo.png');
const heroImage = require('./assets/grassland/grassland-cows-pasture-hero.jpeg(1).jpg');
const grilledHalloumiImage = require('./assets/grassland/halloumi-burger-grilled.jpeg');
const halloumiBurgerImage = require('./assets/grassland/halloumi-burger-recipe.jpeg');
const halloumiChickenSkewersImage = require('./assets/grassland/halloumi-chicken-skewers.jpeg');
const halloumiFigsImage = require('./assets/grassland/grilled-halloumi-figs.jpeg');
const halloumiDinnerIdeasImage = require('./assets/grassland/halloumi-rice-dinner.jpeg');
const halloumiSharingPlatterImage = require('./assets/grassland/halloumi-sharing-platter.jpeg');
const halloumi1kgImage = require('./assets/grassland/grassland-halloumi-1kg.jpg');
const halloumi500gImage = require('./assets/grassland/grassland-halloumi-500g.jpg');
const halloumi200gImage = require('./assets/grassland/grassland-halloumi-200g.jpg');
const mpiRegistrationPdf = require('./assets/quality-compliance/01-MPI-Animal-Products-Exporter-Registration.pdf');
const foodSafetyAuditPdf = require('./assets/quality-compliance/02-Food-Safety-Quality-Audit-Certificate.pdf');
const halloumiProductSpecPdf = require('./assets/quality-compliance/03-Roses-Dairy-Halloumi-Product-Specification.pdf');
const storySectionImages = {
  '01': require('./assets/grassland/grassland-cows-calves.jpeg'),
  '02': require('./assets/grassland/grassland-fresh-milk.jpeg'),
  '03': require('./assets/grassland/grassland-cheese-moulds.jpeg'),
  '04': require('./assets/grassland/grassland-pressing-trays.jpeg'),
  '05': require('./assets/grassland/grassland-halloumi-curds.jpeg'),
} as const;
const storyHeroImage = storySectionImages['01'];

const brandName = 'Grassland Cheese';
const brandTagline = 'PURE GOODNESS FROM OUR PASTURES';
const brandStatement = 'New Zealand Product';
const heroMessage = 'Premium New Zealand Halloumi made for grilling, frying and sharing.';

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
type AuthMode = 'customer-login' | 'admin-login' | 'customer-register' | 'customer-forgot-password' | 'customer-reset-password';
type PublicPage = 'home' | 'shop' | 'recipes' | 'wholesale' | 'about' | 'quality-compliance' | 'cart' | 'account' | 'contact' | 'privacy' | 'terms';
type SignedInPage = PublicPage | 'orders' | 'customers' | 'order-confirmation';

type ConfirmedOrder = {
  orderNumber: string;
  subtotal: number;
  deliveryCharge: number;
  discountApplied: number;
  total: number;
  createdAt: Date | string;
  deliveryAddress?: string | null;
  isTemporaryShippingRate?: boolean;
  shippingZoneLabel?: string | null;
  totalShipmentWeightKg?: number | null;
  items: Array<{ id: number; qty: number; unitPrice: number; product: { id: number; name: string; unit: string } }>;
};

export type SessionState = {
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

type ShopProductSpec = {
  slug: '1kg' | '500g' | '200g';
  name: string;
  size: string;
  description: string;
  detail: string;
  image: ImageSourcePropType;
};

type ShopProductView = ShopProductSpec & {
  product?: ProductRecord;
};

// Mirrors apps/api/src/lib/productWeights.ts so the checkout can preview a
// shipping estimate before the order is submitted (the API always
// recalculates shipping itself from the same weights when the order is
// created — this is only used for the live on-screen estimate).
const PRODUCT_WEIGHT_KG_BY_SLUG: Record<ShopProductSpec['slug'], number> = {
  '1kg': 1.0,
  '500g': 0.5,
  '200g': 0.2,
};

function getProductWeightKg(product: ProductRecord): number {
  const spec = shopProductSpecs.find((candidate) => candidate.name.toLowerCase() === product.name.trim().toLowerCase());
  return spec ? PRODUCT_WEIGHT_KG_BY_SLUG[spec.slug] : 0;
}

type DeliveryAddressForm = {
  name: string;
  addressLine: string;
  suburb: string;
  region: string;
  postcode: string;
  country: string;
};

const emptyDeliveryAddress: DeliveryAddressForm = {
  name: '',
  addressLine: '',
  suburb: '',
  region: '',
  postcode: '',
  country: 'New Zealand',
};

function isDeliveryAddressComplete(address: DeliveryAddressForm) {
  return (
    address.name.trim().length >= 2 &&
    address.addressLine.trim().length >= 3 &&
    address.suburb.trim().length >= 1 &&
    address.postcode.trim().length >= 1 &&
    address.country.trim().length >= 2
  );
}

type RecipeFeature = {
  title: string;
  description: string;
  image: ImageSourcePropType;
};

type StoryJourneyStage = {
  number: string;
  title: string;
  description: string;
  image: ImageSourcePropType;
};

const paymentStatusOptions: Array<PaymentStatus | 'ALL'> = ['ALL', PaymentStatus.PAID, PaymentStatus.OUTSTANDING, PaymentStatus.OVERDUE];

const shopProductSpecs: ShopProductSpec[] = [
  {
    slug: '1kg',
    name: 'Grassland Cheese Halloumi — 1kg',
    size: '1 kg',
    description: 'A generous halloumi format for bigger family meals, grilling trays, and sharing platters.',
    detail: 'Designed for customers who want a larger halloumi format ready for slicing, grilling, frying, and sharing.',
    image: halloumi1kgImage,
  },
  {
    slug: '500g',
    name: 'Grassland Cheese Halloumi — 500g',
    size: '500 g',
    description: 'A versatile mid-size halloumi option for weeknight meals, salads, and pan-frying.',
    detail: 'A balanced everyday halloumi size that suits quick dinners, lunch plates, and smaller entertaining moments.',
    image: halloumi500gImage,
  },
  {
    slug: '200g',
    name: 'Grassland Cheese Halloumi — 200g',
    size: '200 g',
    description: 'A smaller halloumi size that is ideal for lighter meals, snacks, and trial purchases.',
    detail: 'A compact halloumi option for individual meals, smaller households, or customers trying the range for the first time.',
    image: halloumi200gImage,
  },
];

const whyGrasslandItems = [
  {
    title: 'New Zealand Product',
    description: 'A clean, confident brand story anchored in New Zealand product positioning.',
  },
  {
    title: 'Quality Halloumi',
    description: 'A focused range built entirely around halloumi, with no distractions from prepared dishes.',
  },
  {
    title: 'Made for Grilling',
    description: 'Created for cooking moments that suit grilling, pan-frying, and easy sharing at the table.',
  },
  {
    title: 'Everyday to Entertaining',
    description: 'A versatile cheese for quick meals, platters, and simple ways to elevate daily cooking.',
  },
] as const;

const recipeFeatures: RecipeFeature[] = [
  {
    title: 'Grilled Halloumi',
    description: 'Golden, charred halloumi inspiration for simple meals and warm platters.',
    image: grilledHalloumiImage,
  },
  {
    title: 'Halloumi Burger',
    description: 'A burger-style serving idea that stays firmly in the recipe and inspiration category.',
    image: halloumiBurgerImage,
  },
  {
    title: 'Halloumi & Chicken Skewers',
    description: 'An easy entertaining idea pairing grilled halloumi with skewers.',
    image: halloumiChickenSkewersImage,
  },
  {
    title: 'Halloumi with Figs',
    description: 'A serving idea that balances grilled halloumi with fruit and premium presentation.',
    image: halloumiFigsImage,
  },
  {
    title: 'Halloumi Dinner Ideas',
    description: 'Simple dinner inspiration showing how halloumi fits into everyday cooking.',
    image: halloumiDinnerIdeasImage,
  },
  {
    title: 'Halloumi Sharing Platter',
    description: 'A platter-led inspiration card designed for entertaining and sharing occasions.',
    image: halloumiSharingPlatterImage,
  },
];

const storyJourneyStages: StoryJourneyStage[] = [
  {
    number: '01',
    title: 'Where It Begins',
    description: 'The journey starts in open pasture, where the herd is cared for as the first step in bringing Grassland Cheese Halloumi to your table.',
    image: require('./assets/grassland/grassland-cows-calves.jpeg'),
  },
  {
    number: '02',
    title: 'Fresh Milk',
    description: 'Fresh milk moves into the cheesemaking process, connecting the farm stage to the careful production steps that follow.',
    image: require('./assets/grassland/grassland-fresh-milk.jpeg'),
  },
  {
    number: '03',
    title: 'Shaping the Cheese',
    description: 'The cheese is placed into moulds to form its structure, shaping each batch with consistency and care.',
    image: require('./assets/grassland/grassland-cheese-moulds.jpeg'),
  },
  {
    number: '04',
    title: 'Pressing & Preparing',
    description: 'Pressing and preparation refine texture and readiness before the final stage of Halloumi production.',
    image: require('./assets/grassland/grassland-pressing-trays.jpeg'),
  },
  {
    number: '05',
    title: 'Creating Our Halloumi',
    description: 'The final stage shown here captures Halloumi curds as the process comes together into the cheese ready for customers.',
    image: require('./assets/grassland/grassland-halloumi-curds.jpeg'),
  },
];

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Please try again.';
}

function matchesAllowedProduct(product: ProductRecord, spec: ShopProductSpec) {
  return product.name.trim().toLowerCase() === spec.name.toLowerCase();
}

// All retail pricing is quoted in New Zealand Dollars. The catalog/order backend
// (apps/api) is the source of truth for the actual amount; this only controls display
// formatting so the same NZD figure shown here matches what checkout charges.
function formatMoney(amount: number) {
  return `NZD $${amount.toFixed(2)}`;
}

function formatPrice(product?: ProductRecord) {
  return product ? formatMoney(product.effectivePrice) : 'Available Soon';
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
  const [publicPage, setPublicPage] = useState<PublicPage>('home');
  const meQuery = trpc.auth.me.useQuery(undefined, {
    enabled: Boolean(session.token),
    retry: false,
  });

  useEffect(() => {
    if (!session.token || !meQuery.data) {
      return;
    }

    setSession((current) =>
      current.token === session.token ? { ...current, user: meQuery.data as SessionUser } : current,
    );
  }, [meQuery.data, session.token, setSession]);

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
    setPublicPage('home');
  }

  if (!hydrated) {
    return (
      <SafeAreaView style={styles.centeredScreen}>
        <ActivityIndicator size="large" color="#1f5c43" />
      </SafeAreaView>
    );
  }

  if (session.token && !session.user && (meQuery.isLoading || meQuery.isFetching)) {
    return (
      <SafeAreaView style={styles.centeredScreen}>
        <ActivityIndicator size="large" color="#1f5c43" />
      </SafeAreaView>
    );
  }

  if (session.token && session.user) {
    if (session.user.kind === 'staff') {
      return <AdminDashboardScreen session={session} onSignOut={handleSignOut} />;
    }

    return <Dashboard session={session} onSignOut={handleSignOut} />;
  }

  return <PublicWebsite currentPage={publicPage} onNavigate={setPublicPage} onAuthenticated={handleAuthenticated} />;
}

function PublicWebsite({
  currentPage,
  onNavigate,
  onAuthenticated,
}: {
  currentPage: PublicPage;
  onNavigate: (page: PublicPage) => void;
  onAuthenticated: (token: string, user: SessionUser) => Promise<void>;
}) {
  // Retail visitors can browse live halloumi pricing and build a cart before creating
  // an account. This is the same cart storage the signed-in checkout reads on login.
  const [quantities, setQuantities] = useState<Record<number, number>>({});
  const [cartHydrated, setCartHydrated] = useState(false);
  const productsQuery = trpc.catalog.listProducts.useQuery();

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      const storedCart = await getStoredCart();

      if (!cancelled && storedCart) {
        setQuantities(storedCart);
      }

      if (!cancelled) {
        setCartHydrated(true);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!cartHydrated) {
      return;
    }

    void setStoredCart(quantities);
  }, [quantities, cartHydrated]);

  const shopProducts = useMemo<ShopProductView[]>(() => {
    const backendProducts = (productsQuery.data ?? []) as ProductRecord[];
    return shopProductSpecs.map((spec) => ({
      ...spec,
      product: backendProducts.find((product) => matchesAllowedProduct(product, spec)),
    }));
  }, [productsQuery.data]);

  const selectedItems = shopProducts
    .filter((product): product is ShopProductView & { product: ProductRecord } => Boolean(product.product && quantities[product.product.id] > 0))
    .map((product) => ({ ...product.product, qty: quantities[product.product.id] }));

  const cartCount = selectedItems.reduce((sum, item) => sum + item.qty, 0);

  function adjustQuantity(productId: number, nextQuantity: number) {
    setQuantities((current) => ({ ...current, [productId]: Math.max(nextQuantity, 0) }));
  }

  const content = renderPublicPage(currentPage, onNavigate, onAuthenticated, {
    productsQuery,
    shopProducts,
    quantities,
    adjustQuantity,
    selectedItems,
  });

  return (
    <SiteScreen currentPage={currentPage} onNavigate={onNavigate} session={null} cartCount={cartCount}>
      {content}
    </SiteScreen>
  );
}

function renderPublicPage(
  currentPage: PublicPage,
  onNavigate: (page: PublicPage) => void,
  onAuthenticated: (token: string, user: SessionUser) => Promise<void>,
  cart: {
    productsQuery: ReturnType<typeof trpc.catalog.listProducts.useQuery>;
    shopProducts: ShopProductView[];
    quantities: Record<number, number>;
    adjustQuantity: (productId: number, nextQuantity: number) => void;
    selectedItems: Array<ProductRecord & { qty: number }>;
  },
) {
  switch (currentPage) {
    case 'shop':
      return (
        <PublicShopPage
          onNavigate={onNavigate}
          shopProducts={cart.shopProducts}
          isLoading={cart.productsQuery.isLoading}
          quantities={cart.quantities}
          adjustQuantity={cart.adjustQuantity}
        />
      );
    case 'recipes':
      return <RecipesPage />;
    case 'wholesale':
      return <WholesalePage onNavigate={onNavigate} />;
    case 'about':
      return <AboutPage />;
    case 'quality-compliance':
      return <QualityCompliancePage />;
    case 'cart':
      return (
        <PublicCartPage
          onNavigate={onNavigate}
          selectedItems={cart.selectedItems}
          adjustQuantity={cart.adjustQuantity}
        />
      );
    case 'account':
      return <AccountPage onNavigate={onNavigate} onAuthenticated={onAuthenticated} />;
    case 'contact':
      return <ContactPage onNavigate={onNavigate} />;
    case 'privacy':
      return <PrivacyPage />;
    case 'terms':
      return <TermsPage />;
    case 'home':
    default:
      return (
        <HomePage
          onNavigate={onNavigate}
          shopProducts={cart.shopProducts}
          quantities={cart.quantities}
          adjustQuantity={cart.adjustQuantity}
        />
      );
  }
}

function Dashboard({ session, onSignOut }: { session: SessionState; onSignOut: () => Promise<void> }) {
  const user = session.user as SessionUser;
  const [page, setPage] = useState<SignedInPage>('home');
  const [selectedCustomerId, setSelectedCustomerId] = useState<number | undefined>(user.kind === 'customer' ? user.id : undefined);
  const [paymentTerm, setPaymentTerm] = useState<PaymentTerm>(PaymentTerm.PAY_30);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>(PaymentMethod.IN_APP);
  const [quantities, setQuantities] = useState<Record<number, number>>({});
  const [cartHydrated, setCartHydrated] = useState(false);
  const [deliveryAddress, setDeliveryAddress] = useState<DeliveryAddressForm>(emptyDeliveryAddress);
  const [orderNotes, setOrderNotes] = useState('');
  const [lastOrder, setLastOrder] = useState<ConfirmedOrder | null>(null);
  const [orderError, setOrderError] = useState<string | null>(null);
  const [selectedProductSlug, setSelectedProductSlug] = useState<ShopProductSpec['slug'] | null>(null);
  const isStaff = user.kind === 'staff';
  const effectiveCustomerId = user.kind === 'customer' ? user.id : selectedCustomerId;
  const customerQuery = trpc.staff.listCustomers.useQuery(undefined, { enabled: isStaff });
  const productsQuery = trpc.catalog.listProducts.useQuery(
    user.kind === 'staff' && effectiveCustomerId ? { customerId: effectiveCustomerId } : undefined,
    { enabled: user.kind === 'customer' || Boolean(effectiveCustomerId) },
  );
  const createOrder = trpc.orders.create.useMutation();
  const utils = trpc.useUtils();

  useEffect(() => {
    if (user.kind === 'customer') {
      setSelectedCustomerId(user.id);
    }
  }, [user]);

  useEffect(() => {
    if (!isStaff && page === 'customers') {
      setPage('account');
    }
  }, [isStaff, page]);

  useEffect(() => {
    setQuantities({});
  }, [effectiveCustomerId]);

  // Restore any cart saved before a refresh so the customer doesn't lose their selections.
  useEffect(() => {
    let cancelled = false;

    void (async () => {
      const storedCart = await getStoredCart();

      if (!cancelled && storedCart) {
        setQuantities(storedCart);
      }

      if (!cancelled) {
        setCartHydrated(true);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  // Persist the cart whenever it changes so it survives navigation and page refreshes.
  useEffect(() => {
    if (!cartHydrated) {
      return;
    }

    void setStoredCart(quantities);
  }, [quantities, cartHydrated]);

  const shopProducts = useMemo<ShopProductView[]>(() => {
    const backendProducts = (productsQuery.data ?? []) as ProductRecord[];
    return shopProductSpecs.map((spec) => ({
      ...spec,
      product: backendProducts.find((product) => matchesAllowedProduct(product, spec)),
    }));
  }, [productsQuery.data]);

  const selectedItems = shopProducts
    .filter((product): product is ShopProductView & { product: ProductRecord } => Boolean(product.product && quantities[product.product.id] > 0))
    .map((product) => ({ ...product.product, qty: quantities[product.product.id] }));
  const subtotal = selectedItems.reduce((sum, item) => sum + item.qty * item.effectivePrice, 0);
  // Pay Now would previously apply a 10% discount, but Pay Now cannot be
  // completed yet (no payment gateway is connected), so no discount is
  // currently offered at checkout.
  const discount = 0;
  const totalWeightKg = selectedItems.reduce((sum, item) => sum + getProductWeightKg(item) * item.qty, 0);
  const deliveryAddressReady = isDeliveryAddressComplete(deliveryAddress);
  const shippingEstimateQuery = trpc.shipping.estimate.useQuery(
    {
      items: selectedItems.map((item) => ({ productId: item.id, qty: item.qty })),
      destination: {
        country: deliveryAddress.country.trim(),
        region: deliveryAddress.region.trim() || undefined,
        city: deliveryAddress.suburb.trim() || undefined,
        postcode: deliveryAddress.postcode.trim() || undefined,
      },
    },
    { enabled: selectedItems.length > 0 && deliveryAddressReady },
  );
  const deliveryCharge = deliveryAddressReady ? shippingEstimateQuery.data?.amount ?? 0 : 0;
  const total = subtotal - discount + deliveryCharge;
  const cartCount = selectedItems.reduce((sum, item) => sum + item.qty, 0);

  function adjustQuantity(productId: number, nextQuantity: number) {
    setQuantities((current) => ({ ...current, [productId]: Math.max(nextQuantity, 0) }));
  }

  async function submitOrder() {
    setOrderError(null);

    if (!selectedItems.length) {
      Alert.alert('Add items', 'Choose at least one Halloumi product before confirming the order.');
      setOrderError('Choose at least one Halloumi product before confirming the order.');
      return;
    }

    if (user.kind === 'staff' && !effectiveCustomerId) {
      Alert.alert('Choose customer', 'Select a customer before creating an admin order.');
      setOrderError('Select a customer before creating an admin order.');
      return;
    }

    if (paymentTerm === PaymentTerm.PAY_NOW) {
      Alert.alert(
        'Pay now is not available yet',
        'Online card payment is coming soon. Please select "Pay in 30" to place your order today without paying online.',
      );
      setOrderError('Online card payment isn\u2019t available yet. Please select "Pay in 30" to place your order today without paying online.');
      return;
    }

    if (user.kind === 'customer' && !deliveryAddressReady) {
      Alert.alert('Delivery address required', 'Enter your name, address, suburb/town/city, postcode and country before confirming the order.');
      setOrderError('Enter your name, address, suburb/town/city, postcode and country before confirming the order.');
      return;
    }

    try {
      const result = await createOrder.mutateAsync({
        customerId: user.kind === 'staff' ? effectiveCustomerId : undefined,
        paymentTerm,
        items: selectedItems.map((item) => ({ productId: item.id, qty: item.qty })),
        ...(deliveryAddressReady
          ? {
              deliveryAddress: {
                name: deliveryAddress.name.trim(),
                addressLine: deliveryAddress.addressLine.trim(),
                suburb: deliveryAddress.suburb.trim(),
                region: deliveryAddress.region.trim() || undefined,
                postcode: deliveryAddress.postcode.trim(),
                country: deliveryAddress.country.trim(),
              },
            }
          : {}),
        ...(orderNotes.trim() ? { orderNotes: orderNotes.trim() } : {}),
      });
      await Promise.all([utils.orders.list.invalidate(), utils.catalog.listProducts.invalidate()]);
      setQuantities({});
      await clearStoredCart();
      setDeliveryAddress(emptyDeliveryAddress);
      setOrderNotes('');
      setOrderError(null);
      setLastOrder({
        orderNumber: result.orderNumber ?? `GC-${String(result.id).padStart(6, '0')}`,
        subtotal: result.subtotal ?? subtotal,
        deliveryCharge: result.deliveryCharge ?? deliveryCharge,
        discountApplied: result.discountApplied,
        total: result.total,
        createdAt: result.createdAt,
        deliveryAddress: result.deliveryAddress,
        isTemporaryShippingRate: result.isTemporaryShippingRate,
        shippingZoneLabel: result.shippingZoneLabel,
        totalShipmentWeightKg: result.totalShipmentWeightKg,
        items: result.items ?? selectedItems.map((item) => ({ id: item.id, qty: item.qty, unitPrice: item.effectivePrice, product: { id: item.id, name: item.name, unit: item.unit } })),
      });
      setPage('order-confirmation');
    } catch (error) {
      // Alert.alert is a no-op on web (react-native-web), so on the web
      // build the customer would otherwise see nothing happen at all when
      // order creation fails. orderError is rendered directly in the
      // checkout UI so the failure (and the real reason, e.g. a server
      // error) is always visible regardless of platform.
      const message = getErrorMessage(error);
      Alert.alert('Order failed', message);
      setOrderError(message);
    }
  }

  let content;
  switch (page) {
    case 'shop':
      content = (
        <ShopPage
          session={{ ...session, user }}
          isStaff={isStaff}
          customerQuery={customerQuery}
          productsQuery={productsQuery}
          selectedCustomerId={selectedCustomerId}
          setSelectedCustomerId={setSelectedCustomerId}
          paymentTerm={paymentTerm}
          setPaymentTerm={setPaymentTerm}
          paymentMethod={paymentMethod}
          setPaymentMethod={setPaymentMethod}
          quantities={quantities}
          setQuantities={setQuantities}
          shopProducts={shopProducts}
          selectedProductSlug={selectedProductSlug}
          setSelectedProductSlug={setSelectedProductSlug}
          onNavigate={setPage}
        />
      );
      break;
    case 'recipes':
      content = <RecipesPage />;
      break;
    case 'wholesale':
      content = <WholesalePage onNavigate={setPage} />;
      break;
    case 'about':
      content = <AboutPage />;
      break;
    case 'quality-compliance':
      content = <QualityCompliancePage />;
      break;
    case 'cart':
      content = (
        <CartPage
          session={session}
          paymentTerm={paymentTerm}
          setPaymentTerm={setPaymentTerm}
          paymentMethod={paymentMethod}
          setPaymentMethod={setPaymentMethod}
          selectedItems={selectedItems}
          quantities={quantities}
          setQuantities={setQuantities}
          deliveryAddress={deliveryAddress}
          setDeliveryAddress={setDeliveryAddress}
          orderNotes={orderNotes}
          setOrderNotes={setOrderNotes}
          subtotal={subtotal}
          discount={discount}
          deliveryCharge={deliveryCharge}
          total={total}
          totalWeightKg={totalWeightKg}
          deliveryAddressReady={deliveryAddressReady}
          shippingEstimateQuery={shippingEstimateQuery}
          onNavigate={setPage}
          onSubmitOrder={submitOrder}
          isSubmitting={createOrder.isPending}
          orderError={orderError}
        />
      );
      break;
    case 'order-confirmation':
      content = <OrderConfirmationPage order={lastOrder} onNavigate={setPage} />;
      break;
    case 'account':
      content = <SignedInAccountPage session={session} onNavigate={setPage} onSignOut={onSignOut} />;
      break;
    case 'orders':
      content = (
        <OrdersPage
          title={isStaff ? 'Order history' : 'My orders'}
          description={isStaff ? 'Review customer orders and payment status.' : 'Review your Halloumi order history, current orders, and status.'}
        />
      );
      break;
    case 'customers':
      content = <CustomersScreen />;
      break;
    case 'contact':
      content = <ContactPage onNavigate={setPage} />;
      break;
    case 'privacy':
      content = <PrivacyPage />;
      break;
    case 'terms':
      content = <TermsPage />;
      break;
    case 'home':
    default:
      content = (
        <HomePage
          onNavigate={setPage}
          shopProducts={shopProducts}
          quantities={quantities}
          adjustQuantity={adjustQuantity}
        />
      );
      break;
  }

  return (
    <SiteScreen currentPage={page} onNavigate={setPage} session={session} onSignOut={onSignOut} cartCount={cartCount}>
      {content}
    </SiteScreen>
  );
}

function SiteScreen({
  currentPage,
  onNavigate,
  session,
  onSignOut,
  cartCount = 0,
  children,
}: {
  currentPage: SignedInPage | PublicPage;
  onNavigate: (page: any) => void;
  session: SessionState | null;
  onSignOut?: () => Promise<void>;
  cartCount?: number;
  children: ReactNode;
}) {
  const { width } = useWindowDimensions();
  const isCompact = width < 960;

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="dark" />
      <ScrollView style={styles.siteScroll} contentContainerStyle={styles.siteContent}>
        <View style={styles.siteInner}>
          <SiteHeader
            currentPage={currentPage}
            onNavigate={onNavigate}
            session={session}
            onSignOut={onSignOut}
            cartCount={cartCount}
            isCompact={isCompact}
          />
          <View style={styles.pageContentWrap}>{children}</View>
          <SiteFooter currentPage={currentPage} onNavigate={onNavigate} session={session} />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function SiteHeader({
  currentPage,
  onNavigate,
  session,
  onSignOut,
  cartCount,
  isCompact,
}: {
  currentPage: SignedInPage | PublicPage;
  onNavigate: (page: any) => void;
  session: SessionState | null;
  onSignOut?: () => Promise<void>;
  cartCount: number;
  isCompact: boolean;
}) {
  const isStaff = session?.user?.kind === 'staff';
  const navItems: Array<{ label: string; page: SignedInPage | PublicPage }> = [
    { label: 'Home', page: 'home' },
    { label: 'Shop Halloumi', page: 'shop' },
    { label: 'Recipes', page: 'recipes' },
    { label: 'Wholesale', page: 'wholesale' },
    { label: 'Our Story', page: 'about' },
    { label: cartCount > 0 ? `Cart (${cartCount})` : 'Cart', page: 'cart' },
    { label: session ? 'Customer Account' : 'Login', page: 'account' },
    ...(session && !isStaff ? [{ label: 'My Orders', page: 'orders' as const }] : []),
    ...(isStaff ? [{ label: 'Orders', page: 'orders' as const }, { label: 'Customers', page: 'customers' as const }] : []),
  ];

  return (
    <View style={[styles.headerShell, isCompact && styles.headerShellCompact]}>
      <Pressable style={styles.brandLockup} onPress={() => onNavigate('home')}>
        <Image source={grasslandLogo} style={styles.headerLogo} resizeMode="contain" accessibilityLabel="Grassland Cheese logo" />
        <View style={styles.brandCopyWrap}>
          <Text style={styles.brandName}>{brandName}</Text>
          <Text style={styles.brandTagline}>{brandTagline}</Text>
        </View>
      </Pressable>
      <View style={[styles.navRow, isCompact && styles.navRowCompact]}>
        {navItems.map((item) => {
          const selected = item.page === currentPage;
          return (
            <Pressable key={item.page} style={[styles.navButton, selected && styles.navButtonActive]} onPress={() => onNavigate(item.page)}>
              <Text style={[styles.navButtonText, selected && styles.navButtonTextActive]}>{item.label}</Text>
            </Pressable>
          );
        })}
        {session && onSignOut ? (
          <Pressable style={styles.signOutButton} onPress={() => void onSignOut()}>
            <Text style={styles.signOutButtonText}>Sign out</Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

async function openExternalUrl(url: string) {
  try {
    const supported = await Linking.canOpenURL(url);
    if (!supported) {
      Alert.alert('Unable to open link', 'This link is not available right now.');
      return;
    }

    await Linking.openURL(url);
  } catch {
    Alert.alert('Unable to open link', 'This link is not available right now.');
  }
}

function SiteFooter({
  currentPage,
  onNavigate,
  session,
}: {
  currentPage: SignedInPage | PublicPage;
  onNavigate: (page: any) => void;
  session: SessionState | null;
}) {
  const footerLinks: Array<{ label: string; page: SignedInPage | PublicPage }> = [
    { label: 'Shop Halloumi', page: 'shop' },
    { label: 'Recipes', page: 'recipes' },
    { label: 'Wholesale', page: 'wholesale' },
    { label: 'About', page: 'about' },
    { label: 'Quality & Compliance', page: 'quality-compliance' },
    { label: 'Contact', page: 'contact' },
    { label: 'Privacy', page: 'privacy' },
    { label: 'Terms', page: 'terms' },
    { label: 'Cart', page: 'cart' },
    { label: session ? 'Account' : 'Login', page: 'account' },
  ];
  const socialLinks = [
    {
      label: 'Facebook',
      icon: 'f',
      url: 'https://www.facebook.com/profile.php?id=61594610902425',
      iconStyle: styles.footerSocialIconFacebook,
    },
    {
      label: 'TikTok',
      icon: '♪',
      url: 'https://www.tiktok.com/@grassland.cheese',
      iconStyle: styles.footerSocialIconTikTok,
    },
    {
      label: 'Instagram',
      icon: '◉',
      url: 'https://www.instagram.com/grasslandcheese',
      iconStyle: styles.footerSocialIconInstagram,
    },
  ] as const;

  return (
    <View style={styles.footerShell}>
      <View style={styles.footerBrandRow}>
        <Image source={grasslandLogo} style={styles.footerLogo} resizeMode="contain" accessibilityLabel="Grassland Cheese logo" />
        <View style={styles.footerBrandCopy}>
          <Text style={styles.footerBrandName}>{brandName}</Text>
          <Text style={styles.footerBrandTagline}>Pure Goodness From Our Pastures</Text>
          <Text style={styles.footerStatement}>{brandStatement}</Text>
        </View>
      </View>
      <View style={styles.footerLinksWrap}>
        {footerLinks.map((item) => {
          const selected = item.page === currentPage;
          return (
            <Pressable key={item.page} style={styles.footerLinkButton} onPress={() => onNavigate(item.page)}>
              <Text style={[styles.footerLinkText, selected && styles.footerLinkTextActive]}>{item.label}</Text>
            </Pressable>
          );
        })}
      </View>
      <View style={styles.footerSocialSection}>
        <Text style={styles.footerSectionLabel}>Follow us</Text>
        <View style={styles.footerSocialRow}>
          {socialLinks.map((item) => (
            <Pressable
              key={item.label}
              style={styles.footerSocialButton}
              onPress={() => void openExternalUrl(item.url)}
              accessibilityRole="link"
              accessibilityLabel={`Follow Grassland Cheese on ${item.label}`}
            >
              <View style={[styles.footerSocialIcon, item.iconStyle]} accessible={false} importantForAccessibility="no-hide-descendants">
                <Text style={styles.footerSocialIconText}>{item.icon}</Text>
              </View>
              <Text style={styles.footerSocialText}>{item.label}</Text>
            </Pressable>
          ))}
        </View>
      </View>
      <Text style={styles.footerMeta}>Grassland Cheese halloumi recipes are inspiration only and never sold as products.</Text>
    </View>
  );
}

function HomePage({
  onNavigate,
  shopProducts = [],
  quantities,
  adjustQuantity,
}: {
  onNavigate: (page: any) => void;
  shopProducts: ShopProductView[];
  quantities: Record<number, number>;
  adjustQuantity: (productId: number, nextQuantity: number) => void;
}) {
  return (
    <>
      <HeroSection onPrimary={() => onNavigate('shop')} onSecondary={() => onNavigate('about')} />
      <PublicShopSection onNavigate={onNavigate} shopProducts={shopProducts} quantities={quantities} adjustQuantity={adjustQuantity} />
      <WhyGrasslandSection />
      <RecipesSection onNavigate={onNavigate} />
      <StorySection />
      <WholesaleSection onNavigate={onNavigate} />
    </>
  );
}

// React Native Web renders <Image>/<ImageBackground> as a CSS `background-image` on an
// inner <div>, so the `objectPosition` passed via `imageStyle` never reaches a real
// replaced element and has no visual effect (it only affects `object-fit` elements like
// <img>/<video>). To keep the cows + green pasture visible in the hero banner on Expo Web,
// we render a real <img> with `objectFit`/`objectPosition` for web only, while native
// iOS/Android keep using <ImageBackground> unchanged.
//
// IMPORTANT: `Image.resolveAssetSource` (used by a previous, reverted attempt at this fix)
// does not exist on react-native-web's <Image> export and throws at runtime on web,
// crashing the whole app with no error boundary (blank page in production). Use
// `expo-asset`'s `Asset.fromModule`, which is the Expo-supported, cross-platform way to
// resolve a `require()`'d image module to a usable URI, instead.
function resolveWebImageUri(source: ImageSourcePropType): string | null {
  try {
    const uri = Asset.fromModule(source as number | string | { uri: string; width: number; height: number }).uri;
    return typeof uri === 'string' && uri.length > 0 ? uri : null;
  } catch {
    return null;
  }
}

function HeroSection({ onPrimary, onSecondary }: { onPrimary: () => void; onSecondary: () => void }) {
  const { width } = useWindowDimensions();
  const heroHeight = width < 640 ? 420 : width < 1024 ? 520 : 620;
  const heroImageStyle = width < 640 ? styles.heroImageMobile : width < 1024 ? styles.heroImageTablet : styles.heroImageDesktop;

  const heroOverlayContent = (
    <View style={styles.heroOverlay}>
      <View style={styles.heroBadge}>
        <Text style={styles.heroBadgeText}>{brandStatement}</Text>
      </View>
      <Text style={styles.heroTitle}>Pure Goodness From Our Pastures</Text>
      <Text style={styles.heroSubtitle}>{heroMessage}</Text>
      <View style={styles.heroActionRow}>
        <Pressable style={styles.primaryButton} onPress={onPrimary}>
          <Text style={styles.primaryButtonLabel}>Shop Halloumi</Text>
        </Pressable>
        <Pressable style={styles.secondaryHeroButton} onPress={onSecondary}>
          <Text style={styles.secondaryHeroButtonLabel}>Discover Our Story</Text>
        </Pressable>
      </View>
    </View>
  );

  if (Platform.OS === 'web') {
    const heroImageUri = resolveWebImageUri(heroImage);

    return (
      <View style={[styles.heroShell, { minHeight: heroHeight }]}>
        <View style={[styles.heroBackground, styles.heroWebImageWrapper]}>
          {heroImageUri ? (
            <img
              src={heroImageUri}
              alt="Cows grazing on the green Grassland Cheese pasture"
              style={{
                position: 'absolute',
                inset: 0,
                width: '100%',
                height: '100%',
                objectFit: 'cover',
                objectPosition: 'center 85%',
                borderRadius: 32,
              }}
            />
          ) : null}
          {heroOverlayContent}
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.heroShell, { minHeight: heroHeight }]}> 
      <ImageBackground source={heroImage} style={styles.heroBackground} imageStyle={[styles.heroImage, heroImageStyle]} resizeMode="cover">
        {heroOverlayContent}
      </ImageBackground>
    </View>
  );
}

function PublicShopSection({
  onNavigate,
  shopProducts = [],
  quantities,
  adjustQuantity,
}: {
  onNavigate: (page: any) => void;
  shopProducts?: ShopProductView[] | null;
  quantities: Record<number, number>;
  adjustQuantity: (productId: number, nextQuantity: number) => void;
}) {
  // Defensive default: shopProducts should always be an array by the time it reaches this
  // component (it is derived from a fixed list of product specs, never directly from the
  // API response), but a missing/null prop here previously crashed the whole app with
  // "shopProducts.map is not a function". Never let a data-flow regression upstream take
  // down the homepage (and, transitively, customer login) again. The `= []` default only
  // covers `undefined`, so `?? []` below also guards against an explicit `null`.
  const safeShopProducts = shopProducts ?? [];

  if (safeShopProducts.length === 0) {
    return (
      <SectionShell eyebrow="Shop Halloumi" title="Shop Grassland Cheese Halloumi" description="A focused halloumi range with three retail sizes, priced and ready to order.">
        <Text style={styles.metaText}>Halloumi products are not available right now. Please check back shortly.</Text>
      </SectionShell>
    );
  }

  return (
    <SectionShell eyebrow="Shop Halloumi" title="Shop Grassland Cheese Halloumi" description="A focused halloumi range with three retail sizes, priced and ready to order.">
      <View style={styles.productGrid}>
        {safeShopProducts.map((product) => {
          const backendProduct = product.product;
          const quantity = backendProduct ? quantities[backendProduct.id] ?? 0 : 0;
          return (
            <ProductCard
              key={product.slug}
              product={product}
              quantity={quantity}
              onAdd={() => {
                if (!backendProduct) {
                  return;
                }
                adjustQuantity(backendProduct.id, quantity + 1);
              }}
              onOpenDetails={() => onNavigate('shop')}
              onIncrease={backendProduct ? () => adjustQuantity(backendProduct.id, quantity + 1) : undefined}
              onDecrease={backendProduct ? () => adjustQuantity(backendProduct.id, quantity - 1) : undefined}
              disabled={!backendProduct}
              ctaLabel={backendProduct ? 'Add to Cart' : 'Available Soon'}
            />
          );
        })}
      </View>
    </SectionShell>
  );
}

function PublicShopPage({
  onNavigate,
  shopProducts = [],
  isLoading,
  quantities,
  adjustQuantity,
}: {
  onNavigate: (page: any) => void;
  shopProducts?: ShopProductView[] | null;
  isLoading: boolean;
  quantities: Record<number, number>;
  adjustQuantity: (productId: number, nextQuantity: number) => void;
}) {
  // Guard against an explicit `null` too, since the `= []` default only covers `undefined`.
  const safeShopProducts = shopProducts ?? [];

  return (
    <>
      <SectionShell eyebrow="Shop Halloumi" title="Shop Grassland Cheese Halloumi" description="Add halloumi to your cart now, then sign in or create an account to complete checkout.">
        {isLoading ? <Text style={styles.metaText}>Loading live halloumi products…</Text> : null}
        {!isLoading && safeShopProducts.length === 0 ? (
          <Text style={styles.metaText}>Halloumi products are not available right now. Please check back shortly.</Text>
        ) : null}
        <View style={styles.productGrid}>
          {safeShopProducts.map((product) => {
            const backendProduct = product.product;
            const quantity = backendProduct ? quantities[backendProduct.id] ?? 0 : 0;
            return (
              <ProductCard
                key={product.slug}
                product={product}
                quantity={quantity}
                onAdd={() => {
                  if (!backendProduct) {
                    return;
                  }
                  adjustQuantity(backendProduct.id, quantity + 1);
                }}
                onOpenDetails={() => {}}
                onIncrease={backendProduct ? () => adjustQuantity(backendProduct.id, quantity + 1) : undefined}
                onDecrease={backendProduct ? () => adjustQuantity(backendProduct.id, quantity - 1) : undefined}
                disabled={!backendProduct}
                ctaLabel={backendProduct ? 'Add to Cart' : 'Available Soon'}
              />
            );
          })}
        </View>
        <View style={styles.noticeCard}>
          <Text style={styles.noticeTitle}>Halloumi only</Text>
          <Text style={styles.noticeText}>Recipes and food photography remain inspiration only and are never shown as products, prices, cart items, or orderable dishes.</Text>
        </View>
      </SectionShell>
      <WholesaleSection onNavigate={onNavigate} />
    </>
  );
}

function ShopPage({
  session,
  isStaff,
  customerQuery,
  productsQuery,
  selectedCustomerId,
  setSelectedCustomerId,
  paymentTerm,
  setPaymentTerm,
  paymentMethod,
  setPaymentMethod,
  quantities,
  setQuantities,
  shopProducts = [],
  selectedProductSlug,
  setSelectedProductSlug,
  onNavigate,
}: {
  session: SessionState;
  isStaff: boolean;
  customerQuery: ReturnType<typeof trpc.staff.listCustomers.useQuery>;
  productsQuery: ReturnType<typeof trpc.catalog.listProducts.useQuery>;
  selectedCustomerId: number | undefined;
  setSelectedCustomerId: Dispatch<SetStateAction<number | undefined>>;
  paymentTerm: PaymentTerm;
  setPaymentTerm: Dispatch<SetStateAction<PaymentTerm>>;
  paymentMethod: PaymentMethod;
  setPaymentMethod: Dispatch<SetStateAction<PaymentMethod>>;
  quantities: Record<number, number>;
  setQuantities: Dispatch<SetStateAction<Record<number, number>>>;
  shopProducts?: ShopProductView[] | null;
  selectedProductSlug: ShopProductSpec['slug'] | null;
  setSelectedProductSlug: Dispatch<SetStateAction<ShopProductSpec['slug'] | null>>;
  onNavigate: (page: SignedInPage) => void;
}) {
  // Guard against an explicit `null` too, since the `= []` default only covers `undefined`.
  const safeShopProducts = shopProducts ?? [];
  const featuredProduct = safeShopProducts.find((product) => product.slug === selectedProductSlug) ?? null;
  const customers = (customerQuery.data ?? []) as Array<{ id: number; name: string; type: 'WHOLESALE' | 'RETAIL' }>;

  function adjustQuantity(productId: number, nextQuantity: number) {
    setQuantities((current) => ({ ...current, [productId]: Math.max(nextQuantity, 0) }));
  }

  return (
    <>
      <SectionShell eyebrow="Shop Halloumi" title="Shop Grassland Cheese Halloumi" description="Only three customer-facing halloumi products are shown here. If a matching live product is not available from the backend yet, the card stays in an available soon state.">
        {isStaff ? (
          <View style={styles.inlineCard}>
            <Text style={styles.inlineCardTitle}>Order for customer</Text>
            {customerQuery.isLoading ? <Text style={styles.metaText}>Loading customers…</Text> : null}
            {customers.length > 0 ? (
              <SegmentedControl
                groupLabel="Select customer"
                value={String(selectedCustomerId ?? '')}
                options={customers.map((customer) => ({
                  label: `${customer.name} (${customer.type})`,
                  value: String(customer.id),
                }))}
                onChange={(value) => setSelectedCustomerId(Number(value))}
              />
            ) : (
              <Text style={styles.metaText}>Choose a customer to access live pricing and ordering.</Text>
            )}
          </View>
        ) : null}

        <View style={styles.inlineTwoColumnRow}>
          <View style={styles.inlineCardColumn}>
            <View style={styles.inlineCard}>
              <Text style={styles.inlineCardTitle}>Payment terms</Text>
              <SegmentedControl
                groupLabel="Payment term"
                value={paymentTerm}
                options={[
                  { label: 'Pay now (coming soon)', value: PaymentTerm.PAY_NOW, disabled: true },
                  { label: 'Pay in 30', value: PaymentTerm.PAY_30 },
                ]}
                onChange={(value) => setPaymentTerm(value as PaymentTerm)}
              />
              <Text style={styles.metaText}>Online card payment (Pay now) is not connected yet, so it can&apos;t be selected. Choose Pay in 30 to confirm your order today — due date will be set to 30 days from confirmation.</Text>
            </View>
          </View>
          <View style={styles.inlineCardColumn}>
            <View style={styles.inlineCard}>
              <Text style={styles.inlineCardTitle}>Shop note</Text>
              <Text style={styles.metaText}>Recipes stay informational only and never move into the cart or checkout.</Text>
              <Pressable style={styles.secondaryButton} onPress={() => onNavigate('cart')}>
                <Text style={styles.secondaryButtonLabel}>View Cart & Checkout</Text>
              </Pressable>
            </View>
          </View>
        </View>

        {featuredProduct ? (
          <ProductDetailCard
            product={featuredProduct}
            quantity={featuredProduct.product ? quantities[featuredProduct.product.id] ?? 0 : 0}
            onAdd={() => {
              if (!featuredProduct.product) {
                return;
              }
              adjustQuantity(featuredProduct.product.id, (quantities[featuredProduct.product.id] ?? 0) + 1);
            }}
            onIncrease={() => {
              if (!featuredProduct.product) {
                return;
              }
              adjustQuantity(featuredProduct.product.id, (quantities[featuredProduct.product.id] ?? 0) + 1);
            }}
            onDecrease={() => {
              if (!featuredProduct.product) {
                return;
              }
              adjustQuantity(featuredProduct.product.id, (quantities[featuredProduct.product.id] ?? 0) - 1);
            }}
            onClose={() => setSelectedProductSlug(null)}
          />
        ) : null}

        {productsQuery.isLoading ? <Text style={styles.metaText}>Loading live halloumi products…</Text> : null}
        {!productsQuery.isLoading && safeShopProducts.length === 0 ? (
          <Text style={styles.metaText}>Halloumi products are not available right now. Please check back shortly.</Text>
        ) : null}
        <View style={styles.productGrid}>
          {safeShopProducts.map((product) => {
            const backendProduct = product.product;
            const quantity = backendProduct ? quantities[backendProduct.id] ?? 0 : 0;
            return (
              <ProductCard
                key={product.slug}
                product={product}
                quantity={quantity}
                onAdd={() => {
                  if (!backendProduct) {
                    return;
                  }
                  adjustQuantity(backendProduct.id, (quantities[backendProduct.id] ?? 0) + 1);
                }}
                onOpenDetails={() => setSelectedProductSlug(product.slug)}
                onIncrease={
                  backendProduct
                    ? () => adjustQuantity(backendProduct.id, (quantities[backendProduct.id] ?? 0) + 1)
                    : undefined
                }
                onDecrease={
                  backendProduct
                    ? () => adjustQuantity(backendProduct.id, (quantities[backendProduct.id] ?? 0) - 1)
                    : undefined
                }
                disabled={!backendProduct}
                ctaLabel={backendProduct ? 'Add to Cart' : 'Available Soon'}
              />
            );
          })}
        </View>
      </SectionShell>
    </>
  );
}

function ProductCard({
  product,
  quantity,
  onAdd,
  onOpenDetails,
  onIncrease,
  onDecrease,
  disabled,
  ctaLabel,
}: {
  product: ShopProductView;
  quantity: number;
  onAdd: () => void;
  onOpenDetails: () => void;
  onIncrease?: () => void;
  onDecrease?: () => void;
  disabled: boolean;
  ctaLabel: string;
}) {
  return (
    <View style={styles.productCard}>
      <View style={styles.productLogoPanel}>
        <Image source={product.image} style={styles.productLogo} resizeMode="contain" accessibilityLabel={`${product.name} product photo`} />
      </View>
      <Text style={styles.productCardName}>{product.name}</Text>
      <Text style={styles.productCardSize}>{product.size}</Text>
      <Text style={styles.productCardDescription}>{product.description}</Text>
      <Text style={styles.productCardPrice}>{formatPrice(product.product)}</Text>
      <View style={styles.productActionsRow}>
        <Pressable style={styles.detailsButton} onPress={onOpenDetails}>
          <Text style={styles.detailsButtonLabel}>Product details</Text>
        </Pressable>
      </View>
      <View style={styles.quantityPanel}>
        <Text style={styles.quantityPanelLabel}>Quantity</Text>
        <View style={styles.quantityRow}>
          <Pressable disabled={!onDecrease || disabled} style={[styles.quantityButton, disabled && styles.disabledButton]} onPress={onDecrease}>
            <Text style={styles.quantityLabel}>-</Text>
          </Pressable>
          <Text style={styles.quantityValue}>{quantity}</Text>
          <Pressable disabled={!onIncrease || disabled} style={[styles.quantityButton, disabled && styles.disabledButton]} onPress={onIncrease}>
            <Text style={styles.quantityLabel}>+</Text>
          </Pressable>
        </View>
      </View>
      <Pressable disabled={disabled} style={[styles.primaryButton, disabled && styles.disabledPrimaryButton]} onPress={onAdd}>
        <Text style={styles.primaryButtonLabel}>{ctaLabel}</Text>
      </Pressable>
    </View>
  );
}

function ProductDetailCard({
  product,
  quantity,
  onAdd,
  onIncrease,
  onDecrease,
  onClose,
}: {
  product: ShopProductView;
  quantity: number;
  onAdd: () => void;
  onIncrease: () => void;
  onDecrease: () => void;
  onClose: () => void;
}) {
  const isAvailable = Boolean(product.product);

  return (
    <View style={styles.productDetailCard}>
      <View style={styles.productDetailHeader}>
        <View style={styles.productDetailBrandRow}>
          <Image source={grasslandLogo} style={styles.productDetailLogo} resizeMode="contain" accessibilityLabel="Grassland Cheese logo" />
          <View>
            <Text style={styles.sectionEyebrow}>Product details</Text>
            <Text style={styles.productDetailTitle}>{product.name}</Text>
          </View>
        </View>
        <Pressable style={styles.secondaryButton} onPress={onClose}>
          <Text style={styles.secondaryButtonLabel}>Close</Text>
        </Pressable>
      </View>
      <Text style={styles.productCardSize}>{product.size}</Text>
      <Text style={styles.productCardDescription}>{product.detail}</Text>
      <Text style={styles.productCardPrice}>{formatPrice(product.product)}</Text>
      <View style={styles.quantityRow}>
        <Pressable disabled={!isAvailable} style={[styles.quantityButton, !isAvailable && styles.disabledButton]} onPress={onDecrease}>
          <Text style={styles.quantityLabel}>-</Text>
        </Pressable>
        <Text style={styles.quantityValue}>{quantity}</Text>
        <Pressable disabled={!isAvailable} style={[styles.quantityButton, !isAvailable && styles.disabledButton]} onPress={onIncrease}>
          <Text style={styles.quantityLabel}>+</Text>
        </Pressable>
      </View>
      <Pressable disabled={!isAvailable} style={[styles.primaryButton, !isAvailable && styles.disabledPrimaryButton]} onPress={onAdd}>
        <Text style={styles.primaryButtonLabel}>{isAvailable ? 'Add to Cart' : 'Available Soon'}</Text>
      </Pressable>
    </View>
  );
}

function CartPage({
  session,
  paymentTerm,
  setPaymentTerm,
  selectedItems,
  quantities,
  setQuantities,
  deliveryAddress,
  setDeliveryAddress,
  orderNotes,
  setOrderNotes,
  subtotal,
  discount,
  deliveryCharge,
  total,
  totalWeightKg,
  deliveryAddressReady,
  shippingEstimateQuery,
  onNavigate,
  onSubmitOrder,
  isSubmitting,
  orderError,
}: {
  session: SessionState;
  paymentTerm: PaymentTerm;
  setPaymentTerm: Dispatch<SetStateAction<PaymentTerm>>;
  paymentMethod?: PaymentMethod;
  setPaymentMethod?: Dispatch<SetStateAction<PaymentMethod>>;
  selectedItems: Array<ProductRecord & { qty: number }>;
  quantities: Record<number, number>;
  setQuantities: Dispatch<SetStateAction<Record<number, number>>>;
  deliveryAddress: DeliveryAddressForm;
  setDeliveryAddress: Dispatch<SetStateAction<DeliveryAddressForm>>;
  orderNotes: string;
  setOrderNotes: Dispatch<SetStateAction<string>>;
  subtotal: number;
  discount: number;
  deliveryCharge: number;
  total: number;
  totalWeightKg: number;
  deliveryAddressReady: boolean;
  shippingEstimateQuery: {
    data?: { amount: number; isTemporaryRate: boolean; zoneLabel: string; totalShipmentWeightKg: number; parcelCount: number } | null;
    isLoading: boolean;
  };
  onNavigate: (page: SignedInPage) => void;
  onSubmitOrder: () => Promise<void>;
  isSubmitting: boolean;
  orderError: string | null;
}) {
  const isCustomer = session.user?.kind === 'customer';
  const deliveryAddressValid = !isCustomer || deliveryAddressReady;
  const isPayNow = paymentTerm === PaymentTerm.PAY_NOW;

  function changeQuantity(productId: number, nextQuantity: number) {
    setQuantities((current) => ({ ...current, [productId]: Math.max(nextQuantity, 0) }));
  }

  function removeItem(productId: number) {
    setQuantities((current) => {
      const next = { ...current };
      delete next[productId];
      return next;
    });
  }

  function updateAddressField(field: keyof DeliveryAddressForm) {
    return (value: string) => setDeliveryAddress((current) => ({ ...current, [field]: value }));
  }

  return (
    <SectionShell eyebrow="Cart & Checkout" title="Review your Halloumi order" description="Your cart and checkout stay connected to the existing ordering flow.">
      <View style={styles.inlineTwoColumnRow}>
        <View style={styles.inlineCardColumn}>
          <View style={styles.inlineCard}>
            <Text style={styles.inlineCardTitle}>Cart</Text>
            {selectedItems.length ? (
              selectedItems.map((item) => (
                <View key={item.id} style={styles.cartLineItem}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.cartLineTitle}>{item.name}</Text>
                    <Text style={styles.metaText}>{item.qty} × {formatMoney(item.effectivePrice)}</Text>
                    <View style={styles.quantityRow}>
                      <Pressable style={styles.quantityButton} onPress={() => changeQuantity(item.id, item.qty - 1)}>
                        <Text style={styles.quantityLabel}>-</Text>
                      </Pressable>
                      <Text style={styles.quantityValue}>{item.qty}</Text>
                      <Pressable style={styles.quantityButton} onPress={() => changeQuantity(item.id, item.qty + 1)}>
                        <Text style={styles.quantityLabel}>+</Text>
                      </Pressable>
                      <Pressable style={styles.secondaryButton} onPress={() => removeItem(item.id)}>
                        <Text style={styles.secondaryButtonLabel}>Remove</Text>
                      </Pressable>
                    </View>
                  </View>
                  <Text style={styles.cartLineTotal}>{formatMoney(item.qty * item.effectivePrice)}</Text>
                </View>
              ))
            ) : (
              <Text style={styles.metaText}>Your cart is empty. Add one of the halloumi products from the shop page.</Text>
            )}
            {selectedItems.length ? <Text style={styles.metaText}>Total product weight: {totalWeightKg.toFixed(3)} kg</Text> : null}
            <Pressable style={styles.secondaryButton} onPress={() => onNavigate('shop')}>
              <Text style={styles.secondaryButtonLabel}>Back to Shop</Text>
            </Pressable>
          </View>
        </View>
        <View style={styles.inlineCardColumn}>
          <View style={styles.inlineCard}>
            <Text style={styles.inlineCardTitle}>Checkout</Text>
            <Text style={styles.metaText}>Ordering as {session.user?.name}</Text>
            <Text style={styles.metaText}>{session.user?.email}</Text>
            {session.user?.kind === 'customer' && session.user.contact ? <Text style={styles.metaText}>{session.user.contact}</Text> : null}
            {isCustomer ? (
              <>
                <Text style={styles.inlineCardTitle}>Delivery address</Text>
                <Field label="Full name" value={deliveryAddress.name} onChangeText={updateAddressField('name')} />
                <Field label="Address" value={deliveryAddress.addressLine} onChangeText={updateAddressField('addressLine')} />
                <Field label="Suburb / town / city" value={deliveryAddress.suburb} onChangeText={updateAddressField('suburb')} />
                <Field label="Region (if applicable)" value={deliveryAddress.region} onChangeText={updateAddressField('region')} />
                <Field label="Postcode" value={deliveryAddress.postcode} onChangeText={updateAddressField('postcode')} />
                <Field label="Country" value={deliveryAddress.country} onChangeText={updateAddressField('country')} editable={false} />
                <Text style={styles.metaText}>We currently sell and ship within New Zealand only.</Text>
                <Field label="Order notes (optional)" value={orderNotes} onChangeText={setOrderNotes} />
                {!deliveryAddressValid ? (
                  <Text style={styles.errorText}>Enter your name, address, suburb/town/city, postcode and country so shipping can be calculated.</Text>
                ) : null}
              </>
            ) : null}
            <SegmentedControl
              groupLabel="Checkout payment term"
              value={paymentTerm}
              options={[
                { label: 'Pay now (coming soon)', value: PaymentTerm.PAY_NOW, disabled: true },
                { label: 'Pay in 30', value: PaymentTerm.PAY_30 },
              ]}
              onChange={(value) => setPaymentTerm(value as PaymentTerm)}
            />
            {isPayNow ? (
              <Text style={styles.errorText}>Online card payment isn&apos;t connected yet. Please select "Pay in 30" to confirm your order — no payment is required today.</Text>
            ) : (
              <Text style={styles.metaText}>Pay in 30: confirm now, no payment gateway required. Due date is set to 30 days from confirmation.</Text>
            )}
            <Text style={styles.summaryLine}>Subtotal: {formatMoney(subtotal)}</Text>
            <Text style={styles.summaryLine}>Discount: -{formatMoney(discount)}</Text>
            {deliveryAddressReady && shippingEstimateQuery.data ? (
              <Text style={styles.metaText}>
                Delivery destination: {shippingEstimateQuery.data.zoneLabel} · Shipment weight: {shippingEstimateQuery.data.totalShipmentWeightKg.toFixed(3)} kg
                {shippingEstimateQuery.data.parcelCount > 1 ? ` (${shippingEstimateQuery.data.parcelCount} parcels)` : ''}
              </Text>
            ) : null}
            <Text style={styles.summaryLine}>
              Shipping: {deliveryAddressReady ? (shippingEstimateQuery.isLoading ? 'Calculating…' : deliveryCharge > 0 ? formatMoney(deliveryCharge) : 'Free') : 'Enter delivery address to calculate'}
            </Text>
            {deliveryAddressReady && shippingEstimateQuery.data?.isTemporaryRate ? (
              <Text style={styles.metaText}>Shipping shown uses a configurable NZ courier rate table pending our final courier rate card — this is not yet the official price.</Text>
            ) : null}
            <Text style={styles.summaryTotal}>Total: {formatMoney(total)}</Text>
            {orderError ? <Text style={styles.errorText}>{orderError}</Text> : null}
            <Pressable
              disabled={!selectedItems.length || isSubmitting || !deliveryAddressValid || isPayNow}
              style={[styles.primaryButton, (!selectedItems.length || isSubmitting || !deliveryAddressValid || isPayNow) && styles.disabledPrimaryButton]}
              onPress={() => void onSubmitOrder()}
            >
              <Text style={styles.primaryButtonLabel}>{isSubmitting ? 'Processing…' : 'Confirm order'}</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </SectionShell>
  );
}

function OrderConfirmationPage({ order, onNavigate }: { order: ConfirmedOrder | null; onNavigate: (page: SignedInPage) => void }) {
  if (!order) {
    return (
      <SectionShell eyebrow="Order Confirmation" title="No recent order found" description="Place an order from the shop to see your confirmation here.">
        <Pressable style={styles.primaryButton} onPress={() => onNavigate('shop')}>
          <Text style={styles.primaryButtonLabel}>Shop Halloumi</Text>
        </Pressable>
      </SectionShell>
    );
  }

  return (
    <SectionShell eyebrow="Order Confirmation" title="Thank you for your order!" description={`Order ${order.orderNumber} has been received and confirmed.`}>
      <View style={styles.inlineCard}>
        <Text style={styles.inlineCardTitle}>Order {order.orderNumber}</Text>
        <Text style={styles.metaText}>Placed {new Date(order.createdAt).toLocaleString()}</Text>
        {order.items.map((item) => (
          <Text key={item.id} style={styles.orderItemText}>{item.qty} × {item.product.name} @ {formatMoney(item.unitPrice)}</Text>
        ))}
        <Text style={styles.summaryLine}>Subtotal: {formatMoney(order.subtotal)}</Text>
        <Text style={styles.summaryLine}>Discount: -{formatMoney(order.discountApplied)}</Text>
        <Text style={styles.summaryLine}>Shipping: {order.deliveryCharge > 0 ? formatMoney(order.deliveryCharge) : 'Free'}</Text>
        {order.shippingZoneLabel ? (
          <Text style={styles.metaText}>
            Delivery destination: {order.shippingZoneLabel}
            {order.totalShipmentWeightKg ? ` · Shipment weight: ${order.totalShipmentWeightKg.toFixed(3)} kg` : ''}
          </Text>
        ) : null}
        {order.isTemporaryShippingRate ? (
          <Text style={styles.metaText}>Shipping was calculated using a configurable NZ courier rate table pending our final courier rate card — this is not yet the official price.</Text>
        ) : null}
        <Text style={styles.summaryTotal}>Total: {formatMoney(order.total)}</Text>
        {order.deliveryAddress ? <Text style={styles.metaText}>Deliver to:{'\n'}{order.deliveryAddress}</Text> : null}
        <Text style={styles.metaText}>Payment method: Pay in 30</Text>
        <Text style={styles.metaText}>Payment status: Deferred / unpaid</Text>
        <Text style={styles.metaText}>A confirmation email has been sent to your registered email address.</Text>
        <View style={styles.heroActionRow}>
          <Pressable style={styles.primaryButton} onPress={() => onNavigate('account')}>
            <Text style={styles.primaryButtonLabel}>View Order History</Text>
          </Pressable>
          <Pressable style={styles.secondaryButton} onPress={() => onNavigate('shop')}>
            <Text style={styles.secondaryButtonLabel}>Continue Shopping</Text>
          </Pressable>
        </View>
      </View>
    </SectionShell>
  );
}

function PublicCartPage({
  onNavigate,
  selectedItems,
  adjustQuantity,
}: {
  onNavigate: (page: PublicPage) => void;
  selectedItems: Array<ProductRecord & { qty: number }>;
  adjustQuantity: (productId: number, nextQuantity: number) => void;
}) {
  const subtotal = selectedItems.reduce((sum, item) => sum + item.qty * item.effectivePrice, 0);

  return (
    <SectionShell eyebrow="Cart" title="Cart and checkout" description="Sign in or create an account to complete checkout with existing server-side pricing.">
      <View style={styles.inlineCard}>
        <Text style={styles.inlineCardTitle}>Cart</Text>
        {selectedItems.length ? (
          selectedItems.map((item) => (
            <View key={item.id} style={styles.cartLineItem}>
              <View style={{ flex: 1 }}>
                <Text style={styles.cartLineTitle}>{item.name}</Text>
                <Text style={styles.metaText}>{item.qty} × {formatMoney(item.effectivePrice)}</Text>
                <View style={styles.quantityRow}>
                  <Pressable style={styles.quantityButton} onPress={() => adjustQuantity(item.id, item.qty - 1)}>
                    <Text style={styles.quantityLabel}>-</Text>
                  </Pressable>
                  <Text style={styles.quantityValue}>{item.qty}</Text>
                  <Pressable style={styles.quantityButton} onPress={() => adjustQuantity(item.id, item.qty + 1)}>
                    <Text style={styles.quantityLabel}>+</Text>
                  </Pressable>
                  <Pressable style={styles.secondaryButton} onPress={() => adjustQuantity(item.id, 0)}>
                    <Text style={styles.secondaryButtonLabel}>Remove</Text>
                  </Pressable>
                </View>
              </View>
              <Text style={styles.cartLineTotal}>{formatMoney(item.qty * item.effectivePrice)}</Text>
            </View>
          ))
        ) : (
          <Text style={styles.metaText}>Your cart is empty. Add one of the halloumi products from the shop page.</Text>
        )}
        <Pressable style={styles.secondaryButton} onPress={() => onNavigate('shop')}>
          <Text style={styles.secondaryButtonLabel}>Back to Shop</Text>
        </Pressable>
      </View>
      {selectedItems.length ? <Text style={styles.summaryTotal}>Subtotal: {formatMoney(subtotal)}</Text> : null}
      <View style={styles.noticeCard}>
        <Text style={styles.noticeTitle}>Ready to order?</Text>
        <Text style={styles.noticeText}>Sign in or register to complete checkout. Your cart carries over automatically once you're signed in.</Text>
        <Pressable style={styles.primaryButton} onPress={() => onNavigate('account')}>
          <Text style={styles.primaryButtonLabel}>Go to Account</Text>
        </Pressable>
      </View>
    </SectionShell>
  );
}

function RecipesPage() {
  return (
    <>
      <RecipesSection />
      <View style={styles.noticeCard}>
        <Text style={styles.noticeTitle}>Recipes are inspiration only</Text>
        <Text style={styles.noticeText}>Prepared dishes never become products, cart items, inventory, checkout lines, or orderable food.</Text>
      </View>
    </>
  );
}

function RecipesSection({ onNavigate }: { onNavigate?: (page: any) => void } = {}) {
  return (
    <SectionShell eyebrow="Halloumi Inspiration" title="Recipes and serving ideas" description="Use the food photography for inspiration only. The shop continues to sell halloumi cheese only.">
      <View style={styles.recipeGrid}>
        {recipeFeatures.map((recipe) => (
          <View key={recipe.title} style={styles.recipeCard}>
            <Image source={recipe.image} style={styles.recipeCardImage} resizeMode="cover" accessibilityLabel={`${recipe.title} inspiration image`} />
            <Text style={styles.recipeCardTitle}>{recipe.title}</Text>
            <Text style={styles.recipeCardDescription}>{recipe.description}</Text>
          </View>
        ))}
      </View>
      {onNavigate ? (
        <Pressable style={styles.secondaryButton} onPress={() => onNavigate('shop')}>
          <Text style={styles.secondaryButtonLabel}>Back to Halloumi Shop</Text>
        </Pressable>
      ) : null}
    </SectionShell>
  );
}

function WhyGrasslandSection() {
  return (
    <SectionShell eyebrow="Why Grassland Cheese" title="A premium halloumi brand with a clear focus" description="Built around a clean New Zealand identity, premium presentation, and versatile halloumi moments.">
      <View style={styles.valueGrid}>
        {whyGrasslandItems.map((item) => (
          <View key={item.title} style={styles.valueCard}>
            <Text style={styles.valueCardTitle}>{item.title}</Text>
            <Text style={styles.valueCardDescription}>{item.description}</Text>
          </View>
        ))}
      </View>
    </SectionShell>
  );
}

function StorySection() {
  return (
    <SectionShell eyebrow="Our Story" title="From New Zealand Pastures to Your Plate" description="Grassland Cheese brings a warm, premium brand identity to a halloumi range designed for modern home cooking and sharing.">
      <View style={styles.storyCard}>
        <Text style={styles.storyParagraph}>Grassland Cheese is built around a simple promise: premium halloumi presented with warmth, confidence, and an easy sense of occasion.</Text>
        <Text style={styles.storyParagraph}>The brand brings together a clean New Zealand product identity, a focused halloumi offering, and food inspiration that helps customers imagine how to cook, serve, and share it.</Text>
        <Text style={styles.storyParagraph}>From everyday dinners to entertaining platters, Grassland Cheese keeps the range clear, premium, and centered on halloumi.</Text>
      </View>
    </SectionShell>
  );
}

function OurStoryPageSection() {
  const { width } = useWindowDimensions();
  const isMobile = width < 900;
  const isSmallMobile = width < 640;
  const heroHeight = width < 640 ? 340 : width < 1024 ? 430 : 520;

  return (
    <View style={styles.ourStoryPage}>
      <View style={[styles.storyHeroShell, { minHeight: heroHeight }]}>
        <ImageBackground source={storyHeroImage} style={styles.storyHeroBackground} imageStyle={styles.storyHeroImage} resizeMode="cover">
          <View style={styles.storyHeroOverlay}>
            <View style={styles.storyHeroBadge}>
              <Text style={styles.storyHeroBadgeText}>New Zealand Product</Text>
            </View>
            <Text style={[styles.storyHeroTitle, isSmallMobile && styles.storyHeroTitleMobile]}>From Our Pastures to Your Table</Text>
            <Text style={[styles.storyHeroSubtitle, isSmallMobile && styles.storyHeroSubtitleMobile]}>
              Discover the journey behind our Halloumi, from the farm to the finished cheese.
            </Text>
          </View>
        </ImageBackground>
      </View>

      <View style={styles.storyFamilySection}>
        <Text style={[styles.sectionTitle, isSmallMobile && styles.storyJourneyTitleMobile]}>Our Family Story</Text>
        <View style={styles.storyCard}>
          <Text style={styles.storyParagraph}>
            At Rose’s Dairy, cheese-making is more than a craft — it’s a family tradition. Since 2010 we have been producing specialty Halloumi on our boutique dairy farm in Pukekohe, Auckland, using a recipe that has been passed down through generations of our family dynasty.
          </Text>
          <Text style={styles.storyParagraph}>
            We believe good food nourishes both body and spirit. That simple belief guides everything we do. Every batch of our Halloumi begins with fresh, pasteurised whole cow’s milk from the paddock next door. It doesn’t get fresher than that.
          </Text>
        </View>
      </View>

      <View style={styles.storyJourneyShell}>
        {storyJourneyStages.map((stage, index) => {
          const reverseDesktop = !isMobile && index % 2 === 1;
          return (
            <View key={stage.number} style={[styles.storyJourneyRow, reverseDesktop && styles.storyJourneyRowReverse]}>
              <View style={styles.storyJourneyImageColumn}>
                <Image source={stage.image} style={styles.storyJourneyImage} resizeMode="cover" />
              </View>
              <View style={styles.storyJourneyTextColumn}>
                <View style={styles.storyJourneyDecorativeLeaf} />
                <View style={styles.storyJourneyNumberCircle}>
                  <Text style={styles.storyJourneyNumberText}>{stage.number}</Text>
                </View>
                <Text style={[styles.storyJourneyTitle, isSmallMobile && styles.storyJourneyTitleMobile]}>{stage.title}</Text>
                <Text style={styles.storyJourneyDescription}>{stage.description}</Text>
              </View>
            </View>
          );
        })}
      </View>

      <View style={styles.storyFamilySection}>
        <Text style={[styles.sectionTitle, isSmallMobile && styles.storyJourneyTitleMobile]}>What Makes Our Halloumi Special</Text>
        <View style={styles.storyCard}>
          <Text style={styles.storyParagraph}>
            Our Halloumi is soft and gently squeaky, with a clean, creamy flavour that is never overly salty. We use just the right amount of rock salt so the natural taste of the milk shines through.
          </Text>
          <Text style={styles.storyParagraph}>
            Because it is made the traditional way and finished with modern precision, our cheese holds its shape beautifully when cooked. Chefs love it — it flips easily with tongs, browns evenly, and stays consistent batch after batch.
          </Text>
          <Text style={styles.storyParagraph}>
            Whether you fry, grill, bake, or pan-sear it in a little olive oil, Rose’s Halloumi delivers the same wonderful creamy taste every time. It is ready to enjoy straight from the pack and works equally well in savoury or sweet dishes.
          </Text>
        </View>
      </View>

      <View style={styles.storyFamilySection}>
        <Text style={[styles.sectionTitle, isSmallMobile && styles.storyJourneyTitleMobile]}>How to Enjoy It</Text>
        <View style={styles.storyCard}>
          <View style={styles.storyBulletList}>
            <Text style={styles.storyBulletItem}>• Slice and pan-fry until golden for salads, burgers, or warm sandwiches</Text>
            <Text style={styles.storyBulletItem}>• Grill or bake for a delicious centrepiece</Text>
            <Text style={styles.storyBulletItem}>• Pair with honey and pancakes for a sweet treat</Text>
            <Text style={styles.storyBulletItem}>• Add to a plated toaster or simple skillet meal</Text>
          </View>
          <Text style={styles.storyParagraph}>
            Our Halloumi is naturally vegetarian and loved by everyone from age 7 to 70. Once you taste it, you’ll understand why this centuries-old style of cheese has never gone out of favour.
          </Text>
        </View>
      </View>

      <View style={styles.storyFarmToTableSection}>
        <Text style={[styles.sectionTitle, isSmallMobile && styles.storyJourneyTitleMobile]}>From Our Farm to Your Table</Text>
        <View style={styles.storyCard}>
          <Text style={styles.storyParagraph}>
            We operate a small, carefully run facility right on the dairy farm. Modern equipment helps us maintain the highest standards of hygiene and consistency, while the heart of the process remains the time-honoured family methods we have perfected over many years.
          </Text>
        </View>
        <View style={styles.storyBrandStatementCard}>
          <Text style={styles.storyBrandStatement}>Fresh milk. Honest ingredients. A recipe rooted in family history.</Text>
          <Text style={styles.storyBrandClosingLine}>That’s the Rose’s Dairy difference.</Text>
          <Text style={styles.storyBrandClosingLine}>Good food. Good life.</Text>
          <Text style={styles.storyBrandClosingLine}>Rose’s Halloumi — one of a kind.</Text>
        </View>
      </View>

      <View style={styles.storyFamilySection}>
        <Text style={[styles.sectionTitle, isSmallMobile && styles.storyJourneyTitleMobile]}>Our Halloumi</Text>
        <View style={styles.storyBrandStatementCard}>
          <Text style={styles.storyBrandStatement}>One cheese, so many possibilities.</Text>
        </View>
      </View>
    </View>
  );
}

function AboutPage() {
  return (
    <>
      <OurStoryPageSection />
    </>
  );
}

function openQualityDocument(source: ImageSourcePropType) {
  const uri = resolveWebImageUri(source);
  if (!uri) {
    Alert.alert('Unable to open document', 'This document is not available right now.');
    return;
  }
  if (Platform.OS === 'web') {
    // Open in a new browser tab, as PDFs should not replace the current page.
    (globalThis as any).open?.(uri, '_blank', 'noopener,noreferrer');
    return;
  }
  Linking.openURL(uri).catch(() => {
    Alert.alert('Unable to open document', 'This document is not available right now.');
  });
}

function QualityDocumentCard({
  title,
  description,
  meta,
  source,
  viewLabel,
  showDownload,
}: {
  title: string;
  description: string;
  meta: Array<{ label: string; value: string }>;
  source: ImageSourcePropType;
  viewLabel: string;
  showDownload?: boolean;
}) {
  return (
    <View style={styles.qualityDocCard}>
      <Text style={styles.qualityDocTitle}>{title}</Text>
      <Text style={styles.qualityDocDescription}>{description}</Text>
      {meta.length > 0 ? (
        <View style={styles.qualityDocMetaList}>
          {meta.map((item) => (
            <View key={item.label} style={styles.qualityDocMetaRow}>
              <Text style={styles.qualityDocMetaLabel}>{item.label}</Text>
              <Text style={styles.qualityDocMetaValue}>{item.value}</Text>
            </View>
          ))}
        </View>
      ) : null}
      <View style={styles.heroActionRow}>
        <Pressable style={styles.primaryButton} onPress={() => openQualityDocument(source)}>
          <Text style={styles.primaryButtonLabel}>{viewLabel}</Text>
        </Pressable>
        {showDownload ? (
          <Pressable style={styles.secondaryButton} onPress={() => openQualityDocument(source)}>
            <Text style={styles.secondaryButtonLabel}>Download PDF</Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

function QualityCompliancePage() {
  return (
    <SectionShell
      eyebrow="Quality & Compliance"
      title="Quality, safety and product information"
      description="We believe in being transparent about the products we make and the standards that support them. Explore our official Rose's Dairy registration, audit certification and Halloumi product information below."
    >
      <View style={styles.qualitySection}>
        <Text style={styles.qualitySectionHeading}>Official Certifications</Text>
        <View style={styles.qualityDocGrid}>
          <QualityDocumentCard
            title="MPI Animal Products Exporter Registration"
            description="Official MPI Animal Products Exporter registration for AYYILDIZ Limited trading as Roses Dairy (Halloumi Cheese)."
            meta={[
              { label: 'MPI ID', value: 'AEX000656' },
              { label: 'Validity', value: '16 March 2026 – 16 March 2027' },
            ]}
            source={mpiRegistrationPdf}
            viewLabel="View Certificate"
            showDownload
          />
          <QualityDocumentCard
            title="Food Safety & Quality Audit Certificate"
            description="Certificate of Audit for Ayyildiz Ltd, trading as Rose's Halloumi."
            meta={[{ label: 'Certificate expiry', value: '2 January 2027' }]}
            source={foodSafetyAuditPdf}
            viewLabel="View Certificate"
            showDownload
          />
        </View>
      </View>
      <View style={styles.qualitySection}>
        <Text style={styles.qualitySectionHeading}>Halloumi Product Information</Text>
        <View style={styles.qualityDocGrid}>
          <QualityDocumentCard
            title="Rose’s Dairy Halloumi Product Specification"
            description="Product specification containing product, ingredient, storage, preparation, shelf-life and nutrition information."
            meta={[
              { label: 'Product', value: 'Rose’s Dairy Halloumi' },
              { label: 'Description', value: 'Halloumi – semi hard brine salted cheese' },
              { label: 'Ingredients', value: 'Pasteurised Cow’s Milk, Vinegar, Salt, Vegetable Rennet.' },
              { label: 'Preparation', value: 'Fry, grill, bake or poach. Cook until golden brown.' },
              { label: 'Storage', value: 'Refrigerate at colder than 5°C or frozen at -18°C.' },
              { label: 'Opened', value: 'Consume within 5 days once opened.' },
            ]}
            source={halloumiProductSpecPdf}
            viewLabel="View Product Specification"
            showDownload
          />
        </View>
      </View>
    </SectionShell>
  );
}

function WholesalePage({ onNavigate }: { onNavigate: (page: any) => void }) {
  return <WholesaleSection onNavigate={onNavigate} />;
}

function WholesaleSection({ onNavigate }: { onNavigate: (page: any) => void }) {
  return (
    <SectionShell eyebrow="Wholesale" title="Wholesale Grassland Cheese" description="Looking to stock Grassland Cheese Halloumi? Talk to us about wholesale supply.">
      <View style={styles.wholesaleCard}>
        <Text style={styles.wholesaleBody}>Register or sign in to start the customer account path, then talk to us about wholesale access and supply.</Text>
        <View style={styles.heroActionRow}>
          <Pressable style={styles.primaryButton} onPress={() => onNavigate('account')}>
            <Text style={styles.primaryButtonLabel}>Wholesale Enquiries</Text>
          </Pressable>
          <Pressable style={styles.secondaryButton} onPress={() => onNavigate('contact')}>
            <Text style={styles.secondaryButtonLabel}>Contact</Text>
          </Pressable>
        </View>
      </View>
    </SectionShell>
  );
}

const generalEnquiryTypeOptions: Array<{ label: string; value: GeneralEnquiryType }> = [
  { label: 'General enquiry', value: 'GENERAL' },
  { label: 'Product enquiry', value: 'PRODUCT' },
  { label: 'Order enquiry', value: 'ORDER' },
  { label: 'Delivery enquiry', value: 'DELIVERY' },
  { label: 'Other', value: 'OTHER' },
];

type GeneralEnquiryType = 'GENERAL' | 'PRODUCT' | 'ORDER' | 'DELIVERY' | 'OTHER';

function GeneralContactForm() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [enquiryType, setEnquiryType] = useState<GeneralEnquiryType>('GENERAL');
  const [message, setMessage] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  const submitGeneral = trpc.contact.submitGeneral.useMutation();

  function validate(): string | null {
    if (name.trim().length < 1) {
      return 'Enter your name.';
    }
    if (!emailPattern.test(email.trim())) {
      return 'Enter a valid email address.';
    }
    if (message.trim().length < 1) {
      return 'Enter a message.';
    }
    return null;
  }

  async function submit() {
    const validationError = validate();
    if (validationError) {
      setFormError(validationError);
      setSubmitted(false);
      return;
    }

    setFormError(null);

    try {
      await submitGeneral.mutateAsync({
        name: name.trim(),
        email: email.trim(),
        phone: phone.trim() || undefined,
        enquiryType,
        message: message.trim(),
      });
      setSubmitted(true);
      setName('');
      setEmail('');
      setPhone('');
      setEnquiryType('GENERAL');
      setMessage('');
    } catch (error) {
      setSubmitted(false);
      setFormError(getErrorMessage(error));
    }
  }

  return (
    <View style={styles.inlineCard}>
      <Text style={styles.inlineCardTitle}>General enquiry</Text>
      <Field label="Name" value={name} onChangeText={setName} />
      <Field label="Email" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" />
      <Field label="Phone (optional)" value={phone} onChangeText={setPhone} keyboardType="phone-pad" />
      <View style={styles.fieldWrap}>
        <Text style={styles.fieldLabel}>Enquiry type</Text>
        <SegmentedControl
          groupLabel="Enquiry type"
          value={enquiryType}
          options={generalEnquiryTypeOptions}
          onChange={(value) => setEnquiryType(value as GeneralEnquiryType)}
        />
      </View>
      <Field label="Message" value={message} onChangeText={setMessage} multiline />
      {submitted ? <Text style={styles.successText}>Thanks — your enquiry has been sent. We'll be in touch soon.</Text> : null}
      {formError ? <Text style={styles.errorText}>{formError}</Text> : null}
      <Pressable
        disabled={submitGeneral.isPending}
        style={[styles.primaryButton, submitGeneral.isPending && styles.disabledPrimaryButton]}
        onPress={() => void submit()}
      >
        <Text style={styles.primaryButtonLabel}>{submitGeneral.isPending ? 'Sending…' : 'Send enquiry'}</Text>
      </Pressable>
    </View>
  );
}

function WholesaleContactForm() {
  const [businessName, setBusinessName] = useState('');
  const [contactName, setContactName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [businessLocation, setBusinessLocation] = useState('');
  const [message, setMessage] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  const submitWholesale = trpc.contact.submitWholesale.useMutation();

  function validate(): string | null {
    if (businessName.trim().length < 1) {
      return 'Enter your business name.';
    }
    if (contactName.trim().length < 1) {
      return 'Enter a contact name.';
    }
    if (!emailPattern.test(email.trim())) {
      return 'Enter a valid email address.';
    }
    if (businessLocation.trim().length < 1) {
      return 'Enter your business/location.';
    }
    if (message.trim().length < 1) {
      return 'Enter a message.';
    }
    return null;
  }

  async function submit() {
    const validationError = validate();
    if (validationError) {
      setFormError(validationError);
      setSubmitted(false);
      return;
    }

    setFormError(null);

    try {
      await submitWholesale.mutateAsync({
        businessName: businessName.trim(),
        contactName: contactName.trim(),
        email: email.trim(),
        phone: phone.trim() || undefined,
        businessLocation: businessLocation.trim(),
        message: message.trim(),
      });
      setSubmitted(true);
      setBusinessName('');
      setContactName('');
      setEmail('');
      setPhone('');
      setBusinessLocation('');
      setMessage('');
    } catch (error) {
      setSubmitted(false);
      setFormError(getErrorMessage(error));
    }
  }

  return (
    <View style={styles.inlineCard}>
      <Text style={styles.inlineCardTitle}>Wholesale enquiry</Text>
      <Field label="Business name" value={businessName} onChangeText={setBusinessName} />
      <Field label="Contact name" value={contactName} onChangeText={setContactName} />
      <Field label="Email" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" />
      <Field label="Phone (optional)" value={phone} onChangeText={setPhone} keyboardType="phone-pad" />
      <Field label="Business/location" value={businessLocation} onChangeText={setBusinessLocation} />
      <Field label="Message" value={message} onChangeText={setMessage} multiline />
      {submitted ? <Text style={styles.successText}>Thanks — your wholesale enquiry has been sent. We'll be in touch soon.</Text> : null}
      {formError ? <Text style={styles.errorText}>{formError}</Text> : null}
      <Pressable
        disabled={submitWholesale.isPending}
        style={[styles.primaryButton, submitWholesale.isPending && styles.disabledPrimaryButton]}
        onPress={() => void submit()}
      >
        <Text style={styles.primaryButtonLabel}>{submitWholesale.isPending ? 'Sending…' : 'Send wholesale enquiry'}</Text>
      </Pressable>
    </View>
  );
}

function ContactPage({ onNavigate }: { onNavigate: (page: any) => void }) {
  return (
    <SectionShell eyebrow="Contact" title="Get in touch" description="Send us a general enquiry or a wholesale enquiry and the Grassland Cheese team will respond.">
      <GeneralContactForm />
      <WholesaleContactForm />
      <View style={styles.noticeCard}>
        <Text style={styles.noticeTitle}>Already a customer?</Text>
        <Text style={styles.noticeText}>Sign in to your customer account to place orders and view order history.</Text>
        <View style={styles.heroActionRow}>
          <Pressable style={styles.secondaryButton} onPress={() => onNavigate('account')}>
            <Text style={styles.secondaryButtonLabel}>Open Account</Text>
          </Pressable>
        </View>
      </View>
    </SectionShell>
  );
}

function PrivacyPage() {
  return (
    <SectionShell eyebrow="Privacy" title="Privacy" description="A concise overview for the current ordering experience.">
      <View style={styles.noticeCard}>
        <Text style={styles.noticeText}>Grassland Cheese uses account and order details to support sign-in, customer account access, ordering, and order history within the current application experience.</Text>
        <Text style={styles.noticeText}>More detailed privacy content can be published here without changing the existing customer ordering flow.</Text>
      </View>
    </SectionShell>
  );
}

function TermsPage() {
  return (
    <SectionShell eyebrow="Terms" title="Terms" description="A simple placeholder for the current web ordering experience.">
      <View style={styles.noticeCard}>
        <Text style={styles.noticeText}>Product availability and customer access depend on the live catalog records provided by the existing ordering system.</Text>
        <Text style={styles.noticeText}>Recipes and food inspiration remain informational content only and are never treated as orderable products.</Text>
      </View>
    </SectionShell>
  );
}

function AccountPage({
  onNavigate,
  onAuthenticated,
}: {
  onNavigate: (page: PublicPage) => void;
  onAuthenticated: (token: string, user: SessionUser) => Promise<void>;
}) {
  return (
    <SectionShell eyebrow="Customer Account" title="Sign in or create your account" description="Access customer ordering, save your place for future halloumi purchases, and keep wholesale enquiries moving through the existing account flow.">
      <View style={styles.inlineTwoColumnRow}>
        <View style={styles.inlineCardColumn}>
          <View style={styles.brandPanelCard}>
            <Image source={grasslandLogo} style={styles.accountLogo} resizeMode="contain" accessibilityLabel="Grassland Cheese logo" />
            <Text style={styles.brandPanelTitle}>{brandName}</Text>
            <Text style={styles.brandPanelSubtitle}>Premium New Zealand Halloumi made for grilling, frying and sharing.</Text>
            <Text style={styles.brandPanelMeta}>{brandStatement}</Text>
            <Pressable style={styles.secondaryButton} onPress={() => onNavigate('shop')}>
              <Text style={styles.secondaryButtonLabel}>Browse Halloumi</Text>
            </Pressable>
          </View>
        </View>
        <View style={styles.inlineCardColumn}>
          <AuthPanel onAuthenticated={onAuthenticated} />
        </View>
      </View>
    </SectionShell>
  );
}

function SignedInAccountPage({
  session,
  onNavigate,
  onSignOut,
}: {
  session: SessionState;
  onNavigate: (page: SignedInPage) => void;
  onSignOut: () => Promise<void>;
}) {
  const ordersQuery = trpc.orders.list.useQuery();

  return (
    <SectionShell eyebrow="Customer Account" title={`Welcome, ${session.user?.name ?? brandName}`} description="Manage your account, review your ordering history, and keep your halloumi shopping connected to the current sales flow.">
      <View style={styles.inlineTwoColumnRow}>
        <View style={styles.inlineCardColumn}>
          <View style={styles.inlineCard}>
            <Text style={styles.inlineCardTitle}>Account details</Text>
            <Text style={styles.metaText}>{session.user?.email}</Text>
            <Text style={styles.metaText}>{session.user?.kind === 'staff' ? 'Admin access' : `${session.user?.type} customer access`}</Text>
            {session.user?.kind === 'customer' && session.user.contact ? <Text style={styles.metaText}>{session.user.contact}</Text> : null}
            <View style={styles.heroActionRow}>
              <Pressable style={styles.primaryButton} onPress={() => onNavigate('shop')}>
                <Text style={styles.primaryButtonLabel}>Shop Halloumi</Text>
              </Pressable>
              <Pressable style={styles.secondaryButton} onPress={() => void onSignOut()}>
                <Text style={styles.secondaryButtonLabel}>Sign out</Text>
              </Pressable>
            </View>
          </View>
        </View>
        <View style={styles.inlineCardColumn}>
          <View style={styles.inlineCard}>
            <Text style={styles.inlineCardTitle}>Order history</Text>
            {ordersQuery.isLoading ? <Text style={styles.metaText}>Loading orders…</Text> : null}
            {(ordersQuery.data ?? []).slice(0, 3).map((order) => (
              <View key={order.id} style={styles.accountOrderRow}>
                <Text style={styles.cartLineTitle}>Order {order.orderNumber ?? `#${order.id}`}</Text>
                <Text style={styles.metaText}>{new Date(order.createdAt).toLocaleDateString()} • {order.status} • {formatMoney(order.total)}</Text>
              </View>
            ))}
            <Pressable style={styles.secondaryButton} onPress={() => onNavigate('orders')}>
              <Text style={styles.secondaryButtonLabel}>View All Orders</Text>
            </Pressable>
            <Pressable style={styles.secondaryButton} onPress={() => onNavigate('cart')}>
              <Text style={styles.secondaryButtonLabel}>Open Cart & Checkout</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </SectionShell>
  );
}

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Reads a `?token=` query param from the current web URL (used for password reset links). Native platforms never have a URL to read, so this always returns null there. */
function getResetTokenFromWebLocation(): string | null {
  if (Platform.OS !== 'web' || typeof window === 'undefined') {
    return null;
  }

  const params = new URLSearchParams(window.location.search);
  return params.get('token');
}

function AuthPanel({ onAuthenticated }: { onAuthenticated: (token: string, user: SessionUser) => Promise<void> }) {
  const initialResetToken = useMemo(() => getResetTokenFromWebLocation(), []);
  const [mode, setMode] = useState<AuthMode>(initialResetToken ? 'customer-reset-password' : 'customer-login');
  const [resetToken] = useState<string | null>(initialResetToken);
  const [name, setName] = useState('');
  const [contact, setContact] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [infoMessage, setInfoMessage] = useState<string | null>(null);

  const customerLogin = trpc.auth.customerLogin.useMutation();
  const staffLogin = trpc.auth.staffLogin.useMutation();
  const customerRegister = trpc.auth.customerRegister.useMutation();
  const requestPasswordReset = trpc.auth.requestPasswordReset.useMutation();
  const resetPassword = trpc.auth.resetPassword.useMutation();

  const loading =
    customerLogin.isPending ||
    staffLogin.isPending ||
    customerRegister.isPending ||
    requestPasswordReset.isPending ||
    resetPassword.isPending;

  function changeMode(nextMode: AuthMode) {
    setMode(nextMode);
    setFormError(null);
    setInfoMessage(null);
  }

  function validate(): string | null {
    if (mode === 'customer-forgot-password') {
      if (!emailPattern.test(email.trim())) {
        return 'Enter a valid email address.';
      }
      return null;
    }

    if (mode === 'customer-reset-password') {
      if (password.length < 8) {
        return 'Password must be at least 8 characters.';
      }
      if (confirmPassword !== password) {
        return 'Passwords do not match.';
      }
      return null;
    }

    if (!emailPattern.test(email.trim())) {
      return 'Enter a valid email address.';
    }

    if (password.length < 8) {
      return 'Password must be at least 8 characters.';
    }

    if (mode === 'customer-register') {
      if (name.trim().length < 2) {
        return 'Enter your full name.';
      }

      if (emailPattern.test(name.trim())) {
        return 'Enter your full name, not your email address.';
      }

      if (contact.trim().length < 6) {
        return 'Enter a valid mobile number.';
      }

      if (confirmPassword !== password) {
        return 'Passwords do not match.';
      }
    }

    return null;
  }

  async function submit() {
    const validationError = validate();

    if (validationError) {
      setFormError(validationError);
      return;
    }

    setFormError(null);

    try {
      if (mode === 'customer-register') {
        const result = await customerRegister.mutateAsync({
          name: name.trim(),
          contact: contact.trim(),
          email: email.trim(),
          password,
        });
        await onAuthenticated(result.token, result.user as SessionUser);
      } else if (mode === 'customer-forgot-password') {
        await requestPasswordReset.mutateAsync({ email: email.trim() });
        setInfoMessage("If an account exists for that email, we've sent a password reset link. Check your inbox.");
      } else if (mode === 'customer-reset-password') {
        if (!resetToken) {
          setFormError('This password reset link is invalid or has expired.');
          return;
        }
        await resetPassword.mutateAsync({ token: resetToken, password });
        setPassword('');
        setConfirmPassword('');
        setInfoMessage('Your password has been reset. You can now sign in with your new password.');
        changeMode('customer-login');
      } else if (mode === 'customer-login') {
        const result = await customerLogin.mutateAsync({ email: email.trim(), password });
        await onAuthenticated(result.token, result.user as SessionUser);
      } else {
        const result = await staffLogin.mutateAsync({ email: email.trim(), password });
        await onAuthenticated(result.token, result.user as SessionUser);
      }
    } catch (error) {
      setFormError(getErrorMessage(error));
    }
  }

  if (mode === 'admin-login') {
    return (
      <View style={styles.authPanel}>
        <Text style={styles.authPanelTitle}>Admin Login</Text>
        <Field label="Email" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" />
        <Field label="Password" value={password} onChangeText={setPassword} secureTextEntry />
        {formError ? <Text style={styles.errorText}>{formError}</Text> : null}
        <Pressable disabled={loading} style={[styles.primaryButton, loading && styles.disabledPrimaryButton]} onPress={() => void submit()}>
          <Text style={styles.primaryButtonLabel}>{loading ? 'Please wait…' : 'Sign in'}</Text>
        </Pressable>
        <Pressable style={styles.secondaryButton} onPress={() => changeMode('customer-login')}>
          <Text style={styles.secondaryButtonLabel}>Back to Customer Login</Text>
        </Pressable>
      </View>
    );
  }

  if (mode === 'customer-forgot-password') {
    return (
      <View style={styles.authPanel}>
        <Text style={styles.authPanelTitle}>Reset your password</Text>
        <Text style={styles.authPanelSubtitle}>Enter your account email and we'll send you a link to set a new password.</Text>
        <Field label="Email" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" />
        {infoMessage ? <Text style={styles.metaText}>{infoMessage}</Text> : null}
        {formError ? <Text style={styles.errorText}>{formError}</Text> : null}
        <Pressable disabled={loading} style={[styles.primaryButton, loading && styles.disabledPrimaryButton]} onPress={() => void submit()}>
          <Text style={styles.primaryButtonLabel}>{loading ? 'Please wait…' : 'Send reset link'}</Text>
        </Pressable>
        <Pressable style={styles.secondaryButton} onPress={() => changeMode('customer-login')}>
          <Text style={styles.secondaryButtonLabel}>Back to Customer Login</Text>
        </Pressable>
      </View>
    );
  }

  if (mode === 'customer-reset-password') {
    return (
      <View style={styles.authPanel}>
        <Text style={styles.authPanelTitle}>Set a new password</Text>
        {!resetToken ? (
          <Text style={styles.errorText}>This password reset link is invalid or has expired. Request a new one below.</Text>
        ) : (
          <>
            <Field label="New password" value={password} onChangeText={setPassword} secureTextEntry />
            <Field label="Confirm new password" value={confirmPassword} onChangeText={setConfirmPassword} secureTextEntry />
          </>
        )}
        {formError ? <Text style={styles.errorText}>{formError}</Text> : null}
        {resetToken ? (
          <Pressable disabled={loading} style={[styles.primaryButton, loading && styles.disabledPrimaryButton]} onPress={() => void submit()}>
            <Text style={styles.primaryButtonLabel}>{loading ? 'Please wait…' : 'Reset password'}</Text>
          </Pressable>
        ) : null}
        <Pressable style={styles.secondaryButton} onPress={() => changeMode('customer-forgot-password')}>
          <Text style={styles.secondaryButtonLabel}>Request a new reset link</Text>
        </Pressable>
        <Pressable style={styles.secondaryButton} onPress={() => changeMode('customer-login')}>
          <Text style={styles.secondaryButtonLabel}>Back to Customer Login</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.authPanel}>
      <Text style={styles.authPanelTitle}>Welcome to {brandName}</Text>
      <Text style={styles.authPanelSubtitle}>{mode === 'customer-register' ? 'Create Customer Account' : 'Customer Account'}</Text>
      {mode === 'customer-register' ? (
        <>
          <Field label="Full name" value={name} onChangeText={setName} />
          <Field label="Mobile number" value={contact} onChangeText={setContact} keyboardType="default" />
        </>
      ) : null}
      <Field label="Email" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" />
      <Field label="Password" value={password} onChangeText={setPassword} secureTextEntry />
      {mode === 'customer-register' ? (
        <Field label="Confirm password" value={confirmPassword} onChangeText={setConfirmPassword} secureTextEntry />
      ) : null}
      {mode === 'customer-login' ? (
        <Pressable onPress={() => changeMode('customer-forgot-password')}>
          <Text style={styles.adminAccessLink}>Forgot your password?</Text>
        </Pressable>
      ) : null}
      {infoMessage ? <Text style={styles.metaText}>{infoMessage}</Text> : null}
      {formError ? <Text style={styles.errorText}>{formError}</Text> : null}
      <Pressable disabled={loading} style={[styles.primaryButton, loading && styles.disabledPrimaryButton]} onPress={() => void submit()}>
        <Text style={styles.primaryButtonLabel}>{loading ? 'Please wait…' : mode === 'customer-register' ? 'Create account' : 'Sign in'}</Text>
      </Pressable>
      {mode === 'customer-login' ? (
        <>
          <Text style={styles.metaText}>Don&apos;t have an account?</Text>
          <Pressable style={styles.secondaryButton} onPress={() => changeMode('customer-register')}>
            <Text style={styles.secondaryButtonLabel}>Create a customer account</Text>
          </Pressable>
        </>
      ) : (
        <Pressable style={styles.secondaryButton} onPress={() => changeMode('customer-login')}>
          <Text style={styles.secondaryButtonLabel}>Back to Customer Login</Text>
        </Pressable>
      )}
      <View style={styles.adminAccessSection}>
        <Text style={styles.adminAccessLabel}>Admin Access</Text>
        <Pressable onPress={() => changeMode('admin-login')}>
          <Text style={styles.adminAccessLink}>Admin Login</Text>
        </Pressable>
      </View>
    </View>
  );
}

function OrdersPage({ title, description }: { title: string; description: string }) {
  const [statusFilter, setStatusFilter] = useState<PaymentStatus | 'ALL'>('ALL');
  const ordersQuery = trpc.orders.list.useQuery(statusFilter === 'ALL' ? undefined : { paymentStatus: statusFilter });

  return (
    <SectionShell eyebrow="Orders" title={title} description={description}>
      <View style={styles.inlineCard}>
        <Text style={styles.inlineCardTitle}>Payment status</Text>
        <SegmentedControl
          groupLabel="Payment status filter"
          value={statusFilter}
          options={paymentStatusOptions.map((status) => ({ label: status.replace('_', ' '), value: status }))}
          onChange={(value) => setStatusFilter(value as PaymentStatus | 'ALL')}
        />
      </View>
      {ordersQuery.isLoading ? <Text style={styles.metaText}>Loading orders…</Text> : null}
      {(ordersQuery.data ?? []).map((order) => (
        <View key={order.id} style={styles.inlineCard}>
          <Text style={styles.inlineCardTitle}>Order {order.orderNumber ?? `#${order.id}`}</Text>
          <Text style={styles.metaText}>{new Date(order.createdAt).toLocaleString()} • Status: {order.status}</Text>
          <Text style={styles.metaText}>{order.customer.name} • {order.paymentStatus} • ${order.total.toFixed(2)}</Text>
          <Text style={styles.metaText}>{order.paymentTerm === PaymentTerm.PAY_NOW ? 'Pay now' : 'Pay in 30'} • {order.paymentMethod}</Text>
          {order.subtotal !== null ? <Text style={styles.metaText}>Subtotal: {formatMoney(order.subtotal)} • Shipping: {order.deliveryCharge > 0 ? formatMoney(order.deliveryCharge) : 'Free'}</Text> : null}
          {order.staff ? <Text style={styles.metaText}>Created by {order.staff.name}</Text> : null}
          {order.dueDate ? <Text style={styles.metaText}>Due {new Date(order.dueDate).toLocaleDateString()}</Text> : null}
          {order.deliveryAddress ? <Text style={styles.metaText}>Deliver to: {order.deliveryAddress}</Text> : null}
          {order.orderNotes ? <Text style={styles.metaText}>Notes: {order.orderNotes}</Text> : null}
          {order.items.map((item) => (
            <Text key={item.id} style={styles.orderItemText}>{item.qty} × {item.product.name} @ {formatMoney(item.unitPrice)}</Text>
          ))}
        </View>
      ))}
    </SectionShell>
  );
}

function CustomersScreen() {
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
    <SectionShell eyebrow="Customer Management" title="Customer accounts" description="Admins manage each customer's Retail/Wholesale tier. Customers manage their own account details and password.">
      {customersQuery.isLoading ? <Text style={styles.metaText}>Loading customers…</Text> : null}
      {(customersQuery.data ?? []).map((customer) => (
        <View key={customer.id} style={styles.inlineCard}>
          <Text style={styles.inlineCardTitle}>{customer.name}</Text>
          <Text style={styles.metaText}>{customer.email}</Text>
          <Text style={styles.metaText}>{customer.type} • {customer.accountSource.replace('_', ' ')}</Text>
          <Text style={styles.metaText}>{customer.contact || 'No contact recorded'}</Text>
          <Pressable style={styles.secondaryButton} onPress={() => void toggleTier(customer.id, customer.type === 'WHOLESALE' ? 'RETAIL' : 'WHOLESALE')}>
            <Text style={styles.secondaryButtonLabel}>Set {customer.type === 'WHOLESALE' ? 'retail' : 'wholesale'}</Text>
          </Pressable>
        </View>
      ))}
    </SectionShell>
  );
}

function SectionShell({ eyebrow, title, description, children }: { eyebrow: string; title: string; description: string; children: ReactNode }) {
  return (
    <View style={styles.sectionShell}>
      <Text style={styles.sectionEyebrow}>{eyebrow}</Text>
      <Text style={styles.sectionTitle}>{title}</Text>
      <Text style={styles.sectionDescription}>{description}</Text>
      {children}
    </View>
  );
}

function Field(props: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  secureTextEntry?: boolean;
  keyboardType?: 'default' | 'email-address' | 'phone-pad';
  autoCapitalize?: 'none' | 'sentences';
  editable?: boolean;
  multiline?: boolean;
}) {
  return (
    <View style={styles.fieldWrap}>
      <Text style={styles.fieldLabel}>{props.label}</Text>
      <TextInput
        autoCapitalize={props.autoCapitalize ?? 'sentences'}
        keyboardType={props.keyboardType ?? 'default'}
        secureTextEntry={props.secureTextEntry}
        editable={props.editable ?? true}
        multiline={props.multiline}
        style={[styles.input, props.multiline && styles.inputMultiline]}
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
  options: Array<{ label: string; value: string; disabled?: boolean }>;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <View accessibilityLabel={groupLabel} accessibilityRole="radiogroup" style={styles.segmentedControl}>
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <Pressable
            key={option.value}
            disabled={option.disabled}
            accessibilityLabel={option.label}
            accessibilityRole="radio"
            accessibilityState={{ selected, disabled: option.disabled }}
            style={[styles.segment, selected && styles.segmentSelected, option.disabled && styles.disabledButton]}
            onPress={() => {
              if (option.disabled) {
                return;
              }
              onChange(option.value);
            }}
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
    backgroundColor: '#f7f3eb',
  },
  centeredScreen: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f7f3eb',
  },
  siteScroll: {
    flex: 1,
  },
  siteContent: {
    paddingBottom: 32,
  },
  siteInner: {
    width: '100%',
    maxWidth: 1260,
    alignSelf: 'center',
    paddingHorizontal: 16,
    paddingTop: 16,
    gap: 24,
  },
  pageContentWrap: {
    gap: 24,
  },
  headerShell: {
    backgroundColor: '#fffdf8',
    borderRadius: 28,
    paddingVertical: 18,
    paddingHorizontal: 20,
    borderWidth: 1,
    borderColor: '#e7ddc9',
    gap: 16,
  },
  headerShellCompact: {
    paddingHorizontal: 16,
  },
  brandLockup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  headerLogo: {
    width: 150,
    height: 64,
  },
  brandCopyWrap: {
    flexShrink: 1,
  },
  brandName: {
    fontSize: 28,
    fontWeight: '700',
    color: '#123524',
  },
  brandTagline: {
    color: '#8a6b2f',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1.2,
  },
  navRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    alignItems: 'center',
  },
  navRowCompact: {
    justifyContent: 'flex-start',
  },
  navButton: {
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: '#f2ead9',
  },
  navButtonActive: {
    backgroundColor: '#1f5c43',
  },
  navButtonText: {
    color: '#224232',
    fontWeight: '600',
  },
  navButtonTextActive: {
    color: '#fffef8',
  },
  signOutButton: {
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: '#1f5c43',
  },
  signOutButtonText: {
    color: '#1f5c43',
    fontWeight: '700',
  },
  heroShell: {
    borderRadius: 32,
    overflow: 'hidden',
  },
  heroBackground: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  heroWebImageWrapper: {
    position: 'relative',
    overflow: 'hidden',
  },
  heroImage: {
    borderRadius: 32,
  },
  heroImageMobile: {
    objectPosition: 'center 85%',
  },
  heroImageTablet: {
    objectPosition: 'center 85%',
  },
  heroImageDesktop: {
    objectPosition: 'center 85%',
  },
  heroOverlay: {
    backgroundColor: 'rgba(15, 29, 20, 0.45)',
    padding: 28,
    gap: 16,
  },
  heroBadge: {
    alignSelf: 'flex-start',
    backgroundColor: '#f5e7b2',
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  heroBadgeText: {
    color: '#6d5216',
    fontWeight: '700',
  },
  heroTitle: {
    fontSize: 42,
    lineHeight: 48,
    fontWeight: '800',
    color: '#fffdf8',
    maxWidth: 560,
  },
  heroSubtitle: {
    fontSize: 18,
    lineHeight: 28,
    color: '#f5f2ea',
    maxWidth: 520,
  },
  heroActionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  sectionShell: {
    gap: 16,
  },
  sectionEyebrow: {
    color: '#8a6b2f',
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 1.1,
    textTransform: 'uppercase',
  },
  sectionTitle: {
    fontSize: 34,
    lineHeight: 40,
    fontWeight: '800',
    color: '#123524',
  },
  sectionDescription: {
    fontSize: 17,
    lineHeight: 27,
    color: '#4d5c54',
    maxWidth: 760,
  },
  productGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
  },
  productCard: {
    flexBasis: 280,
    flexGrow: 1,
    backgroundColor: '#fffdf8',
    borderRadius: 24,
    padding: 20,
    borderWidth: 1,
    borderColor: '#e7ddc9',
    gap: 12,
  },
  productLogoPanel: {
    backgroundColor: '#f5efe0',
    borderRadius: 18,
    padding: 16,
    alignItems: 'center',
    justifyContent: 'center',
    height: 320,
  },
  productLogo: {
    width: '100%',
    height: '100%',
  },
  productCardName: {
    fontSize: 22,
    fontWeight: '700',
    color: '#123524',
  },
  productCardSize: {
    fontSize: 15,
    color: '#7d6744',
    fontWeight: '700',
  },
  productCardDescription: {
    fontSize: 15,
    lineHeight: 23,
    color: '#4d5c54',
  },
  productCardPrice: {
    fontSize: 24,
    fontWeight: '800',
    color: '#1f5c43',
  },
  productActionsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  detailsButton: {
    paddingVertical: 4,
  },
  detailsButtonLabel: {
    color: '#8a6b2f',
    fontWeight: '700',
  },
  quantityPanel: {
    gap: 8,
  },
  quantityPanelLabel: {
    color: '#4d5c54',
    fontWeight: '600',
  },
  quantityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  quantityButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#d6e6db',
    alignItems: 'center',
    justifyContent: 'center',
  },
  disabledButton: {
    opacity: 0.45,
  },
  quantityLabel: {
    fontSize: 20,
    color: '#123524',
    fontWeight: '700',
  },
  quantityValue: {
    minWidth: 20,
    textAlign: 'center',
    fontWeight: '700',
    color: '#123524',
    fontSize: 16,
  },
  primaryButton: {
    backgroundColor: '#1f5c43',
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 16,
    alignItems: 'center',
  },
  disabledPrimaryButton: {
    opacity: 0.55,
  },
  primaryButtonLabel: {
    color: '#fffef8',
    fontWeight: '700',
    fontSize: 16,
  },
  secondaryButton: {
    borderColor: '#1f5c43',
    borderWidth: 1,
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 16,
    alignItems: 'center',
  },
  secondaryButtonLabel: {
    color: '#1f5c43',
    fontWeight: '700',
  },
  secondaryHeroButton: {
    borderColor: '#fffef8',
    borderWidth: 1,
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 16,
    alignItems: 'center',
  },
  secondaryHeroButtonLabel: {
    color: '#fffef8',
    fontWeight: '700',
    fontSize: 16,
  },
  qualitySection: {
    gap: 16,
  },
  qualitySectionHeading: {
    fontSize: 22,
    fontWeight: '700',
    color: '#123524',
  },
  qualityDocGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
  },
  qualityDocCard: {
    flexBasis: 320,
    flexGrow: 1,
    backgroundColor: '#fffdf8',
    borderRadius: 24,
    padding: 20,
    borderWidth: 1,
    borderColor: '#e7ddc9',
    gap: 12,
  },
  qualityDocTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#123524',
  },
  qualityDocDescription: {
    fontSize: 15,
    lineHeight: 23,
    color: '#4d5c54',
  },
  qualityDocMetaList: {
    gap: 6,
  },
  qualityDocMetaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  qualityDocMetaLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: '#7d6744',
  },
  qualityDocMetaValue: {
    fontSize: 14,
    color: '#4d5c54',
    flexShrink: 1,
  },
  noticeCard: {
    backgroundColor: '#fffdf8',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#e7ddc9',
    padding: 20,
    gap: 12,
  },
  noticeTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#123524',
  },
  noticeText: {
    fontSize: 15,
    lineHeight: 24,
    color: '#4d5c54',
  },
  valueGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
  },
  valueCard: {
    flexBasis: 240,
    flexGrow: 1,
    backgroundColor: '#fffdf8',
    borderRadius: 24,
    padding: 20,
    borderWidth: 1,
    borderColor: '#e7ddc9',
    gap: 10,
  },
  valueCardTitle: {
    fontSize: 19,
    fontWeight: '700',
    color: '#123524',
  },
  valueCardDescription: {
    fontSize: 15,
    lineHeight: 24,
    color: '#4d5c54',
  },
  recipeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
  },
  recipeCard: {
    flexBasis: 300,
    flexGrow: 1,
    backgroundColor: '#fffdf8',
    borderRadius: 24,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#e7ddc9',
  },
  recipeCardImage: {
    width: '100%',
    height: 220,
  },
  recipeCardTitle: {
    paddingHorizontal: 18,
    paddingTop: 16,
    fontSize: 20,
    fontWeight: '700',
    color: '#123524',
  },
  recipeCardDescription: {
    paddingHorizontal: 18,
    paddingTop: 8,
    paddingBottom: 18,
    fontSize: 15,
    lineHeight: 23,
    color: '#4d5c54',
  },
  storyCard: {
    backgroundColor: '#fffdf8',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#e7ddc9',
    padding: 22,
    gap: 12,
  },
  storyParagraph: {
    color: '#4d5c54',
    fontSize: 16,
    lineHeight: 27,
  },
  ourStoryPage: {
    gap: 32,
  },
  storyHeroShell: {
    borderRadius: 32,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#e7ddc9',
  },
  storyHeroBackground: {
    justifyContent: 'flex-end',
    flex: 1,
  },
  storyHeroImage: {
    borderRadius: 32,
  },
  storyHeroOverlay: {
    backgroundColor: 'rgba(18, 53, 36, 0.48)',
    paddingVertical: 34,
    paddingHorizontal: 28,
    gap: 14,
  },
  storyHeroBadge: {
    alignSelf: 'flex-start',
    borderRadius: 999,
    backgroundColor: '#f5e7b2',
    paddingHorizontal: 14,
    paddingVertical: 7,
  },
  storyHeroBadgeText: {
    color: '#6d5216',
    fontWeight: '700',
  },
  storyHeroTitle: {
    fontSize: 46,
    lineHeight: 52,
    fontWeight: '800',
    color: '#fffdf8',
    maxWidth: 700,
  },
  storyHeroTitleMobile: {
    fontSize: 34,
    lineHeight: 40,
  },
  storyHeroSubtitle: {
    fontSize: 18,
    lineHeight: 28,
    color: '#f5f2ea',
    maxWidth: 620,
  },
  storyHeroSubtitleMobile: {
    fontSize: 16,
    lineHeight: 24,
  },
  storyJourneyShell: {
    gap: 24,
  },
  storyJourneyRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 18,
    borderRadius: 28,
    borderWidth: 1,
    borderColor: '#e7ddc9',
    backgroundColor: '#fffdf8',
    overflow: 'hidden',
  },
  storyJourneyRowReverse: {
    flexDirection: 'row-reverse',
  },
  storyJourneyImageColumn: {
    flexBasis: 360,
    flexGrow: 1,
    minHeight: 280,
  },
  storyJourneyImage: {
    width: '100%',
    height: '100%',
    minHeight: 280,
  },
  storyJourneyTextColumn: {
    flexBasis: 320,
    flexGrow: 1,
    paddingVertical: 24,
    paddingHorizontal: 24,
    justifyContent: 'center',
    gap: 12,
    position: 'relative',
  },
  storyJourneyDecorativeLeaf: {
    position: 'absolute',
    width: 110,
    height: 110,
    borderRadius: 55,
    top: -34,
    right: -36,
    backgroundColor: 'rgba(198, 220, 194, 0.28)',
  },
  storyJourneyNumberCircle: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#1f5c43',
    alignItems: 'center',
    justifyContent: 'center',
  },
  storyJourneyNumberText: {
    color: '#fffdf8',
    fontWeight: '800',
    fontSize: 17,
    letterSpacing: 0.4,
  },
  storyJourneyTitle: {
    color: '#123524',
    fontWeight: '800',
    fontSize: 32,
    lineHeight: 38,
  },
  storyJourneyTitleMobile: {
    fontSize: 28,
    lineHeight: 34,
  },
  storyJourneyDescription: {
    color: '#4d5c54',
    fontSize: 16,
    lineHeight: 26,
    maxWidth: 520,
  },
  storyFamilySection: {
    gap: 16,
  },
  storyFarmToTableSection: {
    gap: 16,
  },
  storyBrandStatementCard: {
    backgroundColor: '#1f5c43',
    borderRadius: 24,
    paddingVertical: 28,
    paddingHorizontal: 24,
    gap: 10,
    alignItems: 'center',
  },
  storyBrandStatement: {
    color: '#fffdf8',
    fontSize: 20,
    lineHeight: 28,
    fontWeight: '700',
    textAlign: 'center',
    maxWidth: 640,
  },
  storyBrandClosingLine: {
    color: '#f5e7b2',
    fontSize: 17,
    lineHeight: 24,
    fontWeight: '700',
    textAlign: 'center',
  },
  storyBulletList: {
    gap: 10,
  },
  storyBulletItem: {
    color: '#4d5c54',
    fontSize: 16,
    lineHeight: 26,
  },
  wholesaleCard: {
    backgroundColor: '#123524',
    borderRadius: 28,
    padding: 24,
    gap: 16,
  },
  wholesaleBody: {
    color: '#f9f5ea',
    fontSize: 17,
    lineHeight: 27,
    maxWidth: 620,
  },
  authPanel: {
    backgroundColor: '#fffdf8',
    borderRadius: 24,
    padding: 20,
    borderWidth: 1,
    borderColor: '#e7ddc9',
    gap: 14,
  },
  authPanelTitle: {
    fontSize: 26,
    fontWeight: '700',
    color: '#123524',
  },
  authPanelSubtitle: {
    fontSize: 15,
    lineHeight: 23,
    color: '#4d5c54',
  },
  adminAccessSection: {
    marginTop: 12,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: '#e7ddc9',
    alignItems: 'center',
    gap: 4,
  },
  adminAccessLabel: {
    fontSize: 12,
    color: '#8a8375',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  adminAccessLink: {
    fontSize: 13,
    color: '#4d5c54',
    textDecorationLine: 'underline',
  },
  inlineTwoColumnRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
  },
  inlineCardColumn: {
    flexBasis: 320,
    flexGrow: 1,
  },
  inlineCard: {
    backgroundColor: '#fffdf8',
    borderRadius: 24,
    padding: 20,
    borderWidth: 1,
    borderColor: '#e7ddc9',
    gap: 12,
  },
  inlineCardTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#123524',
  },
  metaText: {
    fontSize: 14,
    lineHeight: 22,
    color: '#4d5c54',
  },
  errorText: {
    fontSize: 13,
    lineHeight: 20,
    color: '#b3261e',
    fontWeight: '600',
  },
  segmentedControl: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  segment: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#d7ceb9',
    paddingVertical: 10,
    paddingHorizontal: 14,
    backgroundColor: '#fffef8',
  },
  segmentSelected: {
    backgroundColor: '#1f5c43',
    borderColor: '#1f5c43',
  },
  segmentLabel: {
    color: '#224232',
    fontWeight: '600',
  },
  segmentLabelSelected: {
    color: '#fffef8',
  },
  fieldWrap: {
    gap: 8,
  },
  fieldLabel: {
    fontWeight: '600',
    color: '#224232',
  },
  input: {
    backgroundColor: '#fffef8',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: '#d7ceb9',
  },
  inputMultiline: {
    minHeight: 110,
    textAlignVertical: 'top',
  },
  successText: {
    fontSize: 13,
    lineHeight: 20,
    color: '#1f5c43',
    fontWeight: '600',
  },
  brandPanelCard: {
    backgroundColor: '#123524',
    borderRadius: 24,
    padding: 24,
    gap: 16,
    minHeight: 320,
    justifyContent: 'center',
  },
  accountLogo: {
    width: '100%',
    height: 90,
    alignSelf: 'center',
  },
  brandPanelTitle: {
    fontSize: 30,
    fontWeight: '800',
    color: '#fffef8',
  },
  brandPanelSubtitle: {
    fontSize: 16,
    lineHeight: 24,
    color: '#edf5ee',
  },
  brandPanelMeta: {
    color: '#f2d77e',
    fontWeight: '700',
  },
  accountOrderRow: {
    paddingVertical: 4,
    gap: 4,
  },
  cartLineItem: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'center',
  },
  cartLineTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#123524',
  },
  cartLineTotal: {
    fontSize: 16,
    fontWeight: '700',
    color: '#123524',
  },
  summaryLine: {
    color: '#4d5c54',
    fontSize: 15,
  },
  summaryTotal: {
    color: '#123524',
    fontSize: 20,
    fontWeight: '800',
  },
  productDetailCard: {
    backgroundColor: '#fffdf8',
    borderRadius: 24,
    padding: 22,
    borderWidth: 1,
    borderColor: '#e7ddc9',
    gap: 14,
  },
  productDetailHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 16,
    flexWrap: 'wrap',
  },
  productDetailBrandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    flexShrink: 1,
  },
  productDetailLogo: {
    width: 120,
    height: 56,
  },
  productDetailTitle: {
    fontSize: 28,
    lineHeight: 34,
    fontWeight: '800',
    color: '#123524',
  },
  orderItemText: {
    color: '#4d5c54',
  },
  footerShell: {
    backgroundColor: '#123524',
    borderRadius: 28,
    padding: 24,
    gap: 16,
  },
  footerBrandRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
    alignItems: 'center',
  },
  footerLogo: {
    width: 150,
    height: 64,
  },
  footerBrandCopy: {
    gap: 4,
  },
  footerBrandName: {
    fontSize: 24,
    fontWeight: '800',
    color: '#fffef8',
  },
  footerBrandTagline: {
    color: '#f0e7d2',
    fontSize: 14,
  },
  footerStatement: {
    color: '#f2d77e',
    fontWeight: '700',
  },
  footerLinksWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  footerLinkButton: {
    paddingVertical: 4,
    paddingRight: 8,
  },
  footerLinkText: {
    color: '#f0e7d2',
    fontWeight: '600',
  },
  footerLinkTextActive: {
    color: '#f2d77e',
  },
  footerSocialSection: {
    gap: 12,
  },
  footerSectionLabel: {
    color: '#fffef8',
    fontSize: 16,
    fontWeight: '700',
  },
  footerSocialRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  footerSocialButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: '#1f4630',
  },
  footerSocialIcon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  footerSocialIconFacebook: {
    backgroundColor: '#1877f2',
  },
  footerSocialIconTikTok: {
    backgroundColor: '#000000',
  },
  footerSocialIconInstagram: {
    backgroundColor: '#c13584',
  },
  footerSocialIconText: {
    color: '#fffef8',
    fontSize: 16,
    fontWeight: '800',
    lineHeight: 18,
  },
  footerSocialText: {
    color: '#f0e7d2',
    fontWeight: '600',
  },
  footerMeta: {
    color: '#d7ddda',
    lineHeight: 22,
  },
});
