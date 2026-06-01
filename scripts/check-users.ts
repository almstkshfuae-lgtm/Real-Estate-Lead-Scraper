import prisma from '../lib/prisma'

async function main() {
  try {
    const users = await prisma.user.findMany({ select: { id: true, email: true, passwordHash: true } })
    console.log(`USERS_COUNT=${users.length}`)
    for (const u of users) {
      console.log(`${u.id}\t${u.email}\t${u.passwordHash?.slice(0,8) ?? ''}...`)
    }
  } catch (err) {
    console.error('Error querying users:', err)
    process.exitCode = 1
  } finally {
    await prisma.$disconnect()
  }
}

main()
