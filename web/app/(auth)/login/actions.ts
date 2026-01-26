"use server";
import { loginSchema, LoginFormState } from "@/lib/validations/authSchema";
import { signIn } from "@/lib/auth/auth";
import { redirect } from "next/navigation";
import { AuthError } from "next-auth";

export async function loginAction(
	prevState: LoginFormState,
	formData: FormData
): Promise<LoginFormState> {
	const parsed = loginSchema.safeParse({
		email: formData.get("email"),
		password: formData.get("password"),
	});
	
	if (!parsed.success) {
		return { error: "Invalid input" };
	}

	try {
		const result = await signIn("credentials", {
			email: parsed.data.email,
			password: parsed.data.password,
			redirect: false,
		});

		// If we reach here, sign in was successful
		// Redirect will be handled by middleware based on role
		redirect("/conductor/dashboard");
	} catch (error) {
		if (error instanceof AuthError) {
			return { error: "Invalid email or password" };
		}
		throw error;
	}
}
