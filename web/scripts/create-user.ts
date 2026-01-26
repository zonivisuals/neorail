import { prismaClient as prisma } from '@/lib/prisma';
import bcrypt from 'bcryptjs';

async function createUser() {
  // Change these values to create different users
  const email = 'conductor1@test.com';
  const password = 'conductor1';
  const role = 'CONDUCTOR'; // or 'ADMIN'

  try {
    const passwordHash = await bcrypt.hash(password, 10);
    console.log(passwordHash)

    const user = await prisma.user.create({
      data: {
        email,
        password: passwordHash,
        role,
      },
    });

    console.log('✅ User created successfully:');
    console.log({
      id: user.id,
      email: user.email,
      role: user.role,
    });
  } catch (error: any) {
    console.error('❌ Error creating user:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

createUser();
