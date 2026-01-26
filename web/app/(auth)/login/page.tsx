import LoginForm from "./LoginForm";
import { redirectIfAuthenticated } from "@/lib/auth/auth-guard";

export default async function LoginPage() {
	// Redirect if already authenticated
	await redirectIfAuthenticated();
	
	return <LoginForm />;
}
