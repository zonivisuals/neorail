import { prismaClient as prisma } from '../prisma';
import { UserRole } from '../../generated/prisma/enums';
import bcrypt from 'bcryptjs';

export type AuthResult =
	| { success: true; user: { id: string; email: string; role: UserRole } }
	| { success: false; error: string };

export async function verifyCredentials(email: string, password: string): Promise<AuthResult> {
	const user = await prisma.user.findUnique({ where: { email } });
    console.log("user", user)
	if (!user) {
        console.log("no user found")
		return { success: false, error: 'Invalid email or password' };
	}
	const valid = await bcrypt.compare(password, user.password);
	if (!valid) {
        console.log("invalid password")
		return { success: false, error: 'Invalid email or password' };
	}
	return {
		success: true,
		user: {
			id: user.id,
			email: user.email,
			role: user.role,
		},
	};
}
