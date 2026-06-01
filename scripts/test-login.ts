import prisma from '../lib/prisma'
import bcrypt from 'bcryptjs'

async function main() {
  try {
    const email = 'admin@brilliance.ae'
    const password = 'admin123'
    const user = await prisma.user.findUnique({ where: { email } })
    if (!user) {
      console.error('User not found')
      process.exitCode = 2
      return
    }
    const ok = await bcrypt.compare(password, user.passwordHash)
    console.log('found user:', user.email, 'bcrypt match:', ok)
  } catch (err) {
    console.error(err)
    process.exitCode = 1
  } finally {
    await prisma.$disconnect()
  }
}

main()
