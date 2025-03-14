import { MigrationInterface, QueryRunner } from 'typeorm'

export class AddPgPubSubSampleEntities1741912826134 implements MigrationInterface {
  name = 'AddPgPubSubSampleEntities1741912826134'

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "public"."pgpubsub_notifications_type_enum" AS ENUM('info', 'warning', 'error')`
    )
    await queryRunner.query(
      `CREATE TABLE "pgpubsub_notifications" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "title" character varying NOT NULL, "content" text NOT NULL, "type" "public"."pgpubsub_notifications_type_enum" NOT NULL DEFAULT 'info', "read" boolean NOT NULL DEFAULT false, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "userId" uuid NOT NULL, CONSTRAINT "PK_1a865646cccde50ed8232c8dede" PRIMARY KEY ("id"))`
    )
    await queryRunner.query(
      `CREATE TABLE "pgpubsub_users" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "name" character varying NOT NULL, "email" character varying NOT NULL, CONSTRAINT "UQ_0889d107eda5a3f24961b0ae887" UNIQUE ("email"), CONSTRAINT "PK_dd60c2ee7c2673ec58f9bf32ef5" PRIMARY KEY ("id"))`
    )
    await queryRunner.query(
      `ALTER TABLE "pgpubsub_notifications" ADD CONSTRAINT "FK_f8641505c80d0ca78fc849c6e2d" FOREIGN KEY ("userId") REFERENCES "pgpubsub_users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`
    )
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "pgpubsub_notifications" DROP CONSTRAINT "FK_f8641505c80d0ca78fc849c6e2d"`)
    await queryRunner.query(`DROP TABLE "pgpubsub_users"`)
    await queryRunner.query(`DROP TABLE "pgpubsub_notifications"`)
    await queryRunner.query(`DROP TYPE "public"."pgpubsub_notifications_type_enum"`)
  }
}
