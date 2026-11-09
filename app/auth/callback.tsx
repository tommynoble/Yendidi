import { Redirect } from 'expo-router';

// Google sign-in returns to yendidii://auth/callback. The login screen finishes the sign-in itself, so this
// only stops the router showing "unmatched route" if the system also delivers that link to the app.
export default function AuthCallback() {
    return <Redirect href="/" />;
}
