import { StatusBar } from 'expo-status-bar';
import { StyleSheet, Text, View } from 'react-native';
import { useStyles, ThemeValue } from './src/theme';

export default function App() {
  const styles = useStyles(makeStyles);
  return (
    <View style={styles.container}>
      <Text style={styles.text}>Gymholik Mobile App</Text>
      <StatusBar style="auto" />
    </View>
  );
}

const makeStyles = (theme: ThemeValue) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.colors.bg,
      alignItems: 'center',
      justifyContent: 'center',
    },
    text: {
      color: theme.colors.text,
      fontFamily: theme.fonts.bodyRegular,
    },
  });
