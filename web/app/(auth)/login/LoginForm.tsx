"use client";
import { useActionState } from "react";
import { loginAction } from "./actions";
import { LoginFormState } from "@/lib/validations/authSchema";

export default function LoginForm() {
	const [state, formAction] = useActionState<LoginFormState, FormData>(
		loginAction,
		{ error: undefined, success: false }
	);
	return (
		<form action={formAction} className="max-w-sm mx-auto mt-10 p-6 bg-white rounded shadow flex flex-col gap-4">
			<h1 className="text-2xl font-bold mb-2">Login</h1>
			<input
				name="email"
				type="email"
				placeholder="Email"
				className="border p-2 rounded"
				required
			/>
			<input
				name="password"
				type="password"
				placeholder="Password"
				className="border p-2 rounded"
				required
			/>
			{state.error && (
				<div className="text-red-600 text-sm">{state.error}</div>
			)}
			<button
				type="submit"
				className="bg-black text-white py-2 rounded hover:bg-gray-800"
			>
				Login
			</button>
		</form>
	);
}
