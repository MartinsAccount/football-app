import { Link, Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useColorScheme, View } from 'react-native';
import { useRnTheme } from '@/lib/theme';

export default function RootLayout() {
	const t = useRnTheme();
	const scheme = useColorScheme();
	return (
		<>
			<StatusBar style={scheme === 'light' ? 'dark' : 'light'} />
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
						headerRight: () => (
							<View style={{ flexDirection: 'row', gap: t.space[8] }}>
								<Link href="/slip" style={{ color: t.color.accent.text, fontSize: t.font.size.body }}>
									Szelvény
								</Link>
								<Link href="/evaluation" style={{ color: t.color.accent.text, fontSize: t.font.size.body }}>
									Kiértékelés
								</Link>
								<Link href="/settings" style={{ color: t.color.accent.text, fontSize: t.font.size.body }}>
									Beállítások
								</Link>
							</View>
						)
					}}
				/>
				<Stack.Screen name="slip" options={{ title: 'Szelvény' }} />
				<Stack.Screen name="evaluation" options={{ title: 'Kiértékelés' }} />
				<Stack.Screen name="settings" options={{ title: 'Kapcsolat' }} />
			</Stack>
		</>
	);
}
