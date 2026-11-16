import { Link, Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { View } from 'react-native';
import { PreferencesProvider } from '@/lib/preferences';
import { useRnTheme, useThemeName } from '@/lib/theme';

export default function RootLayout() {
	return (
		<PreferencesProvider>
			<AppStack />
		</PreferencesProvider>
	);
}

function AppStack() {
	const t = useRnTheme();
	const theme = useThemeName();
	const link = { color: t.color.accent.text, fontSize: t.font.size.body };
	return (
		<>
			<StatusBar style={theme === 'light' ? 'dark' : 'light'} />
			<Stack
				screenOptions={{
					headerStyle: { backgroundColor: t.color.bg.surface },
					headerTintColor: t.color.text.primary,
					contentStyle: { backgroundColor: t.color.bg.canvas }
				}}
			>
				<Stack.Screen
					name="index"
					options={{
						title: 'Meccsek',
						// TODO(polish): 3 link a fejlécben → tab-navigáció.
						headerRight: () => (
							<View style={{ flexDirection: 'row', gap: t.space[8] }}>
								<Link href="/slip" style={link}>
									Szelvény
								</Link>
								<Link href="/evaluation" style={link}>
									Kiértékelés
								</Link>
								<Link href="/preferences" style={link}>
									Beállítások
								</Link>
							</View>
						)
					}}
				/>
				<Stack.Screen name="slip" options={{ title: 'Szelvény' }} />
				<Stack.Screen name="evaluation" options={{ title: 'Kiértékelés' }} />
				<Stack.Screen name="preferences" options={{ title: 'Beállítások' }} />
				<Stack.Screen name="arbitrage" options={{ title: 'Arbitrázs' }} />
				<Stack.Screen name="settings" options={{ title: 'Kapcsolat' }} />
			</Stack>
		</>
	);
}
