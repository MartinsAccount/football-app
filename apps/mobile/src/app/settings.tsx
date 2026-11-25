import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { router } from 'expo-router';
import { loadConnection, saveConnection } from '@/lib/connection';
import { useRnTheme } from '@/lib/theme';

/** API base URL + Bearer token (expo-secure-store). A token mezője rejtett, és sehol nem kerül logba. */
export default function SettingsScreen() {
	const t = useRnTheme();
	const s = styles(t);
	const [baseUrl, setBaseUrl] = useState('');
	const [token, setToken] = useState('');
	const [status, setStatus] = useState('');

	useEffect(() => {
		void loadConnection().then((c) => {
			setBaseUrl(c.baseUrl);
			setToken(c.token);
		});
	}, []);

	const save = async () => {
		try {
			await saveConnection({ baseUrl, token });
			router.back();
		} catch {
			setStatus('A mentés nem sikerült.');
		}
	};

	return (
		<View style={s.page}>
			<Text style={s.label}>API címe</Text>
			<TextInput
				style={s.input}
				value={baseUrl}
				onChangeText={setBaseUrl}
				placeholder="http://192.168.1.10:5100"
				placeholderTextColor={t.color.text.muted}
				autoCapitalize="none"
				autoCorrect={false}
				keyboardType="url"
			/>
			<Text style={s.label}>Token</Text>
			<TextInput
				style={s.input}
				value={token}
				onChangeText={setToken}
				placeholder="npm run token -w @football/server"
				placeholderTextColor={t.color.text.muted}
				autoCapitalize="none"
				autoCorrect={false}
				secureTextEntry
			/>
			<Text style={s.hint}>Lokális dev-szerveren token nélkül is működik (ADR-0005).</Text>
			<Pressable style={s.button} onPress={save} accessibilityRole="button">
				<Text style={s.buttonText}>Mentés</Text>
			</Pressable>
			{status ? <Text style={s.error}>{status}</Text> : null}
		</View>
	);
}

const styles = (t: ReturnType<typeof useRnTheme>) =>
	StyleSheet.create({
		page: { padding: t.space[8], gap: t.space[4] },
		label: { color: t.color.text.secondary, fontSize: t.font.size.small },
		input: {
			color: t.color.text.primary,
			backgroundColor: t.color.bg.inset,
			borderColor: t.color.border.strong,
			borderWidth: 1,
			borderRadius: t.radius.m,
			padding: t.space[6],
			fontSize: t.font.size.body
		},
		hint: { color: t.color.text.muted, fontSize: t.font.size.caption },
		button: {
			backgroundColor: t.color.accent.default,
			borderRadius: t.radius.m,
			padding: t.space[6],
			alignItems: 'center',
			marginTop: t.space[4]
		},
		buttonText: { color: t.color.accent.on, fontSize: t.font.size.body, fontWeight: '700' },
		error: { color: t.color.signal['negative-text'], fontSize: t.font.size.small }
	});
