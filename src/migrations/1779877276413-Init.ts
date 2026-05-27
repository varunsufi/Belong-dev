import { MigrationInterface, QueryRunner } from "typeorm";

export class Init1779877276413 implements MigrationInterface {
    name = 'Init1779877276413'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "rewards" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "name" character varying(160) NOT NULL, "description" text NOT NULL, "points_cost" integer NOT NULL, "is_available" boolean NOT NULL DEFAULT true, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "CHK_0503fd76830d9145e9e6c037a8" CHECK ("points_cost" > 0), CONSTRAINT "PK_3d947441a48debeb9b7366f8b8c" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_1d7ed66691090d50235bfd7582" ON "rewards" ("name") `);
        await queryRunner.query(`CREATE INDEX "IDX_36bebf78f11fd93825303233b6" ON "rewards" ("is_available") `);
        await queryRunner.query(`CREATE TYPE "public"."reward_redemption_status_enum" AS ENUM('pending', 'fulfilled', 'cancelled')`);
        await queryRunner.query(`CREATE TABLE "reward_redemptions" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "user_id" uuid NOT NULL, "reward_id" uuid NOT NULL, "points_spent" integer NOT NULL, "status" "public"."reward_redemption_status_enum" NOT NULL DEFAULT 'pending', "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "CHK_ef69256e6a735b14f2f6a85ef9" CHECK ("points_spent" > 0), CONSTRAINT "PK_e02d178fa8c54295d8edc8781b3" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_8e40cc924716518bc5d1828ce3" ON "reward_redemptions" ("user_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_6b13532c084052b9d0a749f8ed" ON "reward_redemptions" ("reward_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_9cb988ade6c1d825c2535e7667" ON "reward_redemptions" ("status") `);
        await queryRunner.query(`CREATE TABLE "user_tokens" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "user_id" uuid NOT NULL, "access_token_hash" character(64) NOT NULL, "refresh_token_hash" character(64) NOT NULL, "access_token_expires_at" TIMESTAMP WITH TIME ZONE NOT NULL, "refresh_token_expires_at" TIMESTAMP WITH TIME ZONE NOT NULL, "revoked_at" TIMESTAMP WITH TIME ZONE, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_63764db9d9aaa4af33e07b2f4bf" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_9e144a67be49e5bba91195ef5d" ON "user_tokens" ("user_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_fa382ad99ae6a6058ae8d12325" ON "user_tokens" ("access_token_hash") `);
        await queryRunner.query(`CREATE INDEX "IDX_497411b2dd739450fbd25f7db7" ON "user_tokens" ("refresh_token_hash") `);
        await queryRunner.query(`CREATE INDEX "IDX_d777f2f34aa5b93dc2a1c62a78" ON "user_tokens" ("revoked_at") `);
        await queryRunner.query(`CREATE TABLE "users" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "email" character varying(255) NOT NULL, "password_hash" character varying(255) NOT NULL, "total_points" integer NOT NULL DEFAULT '0', "display_name" character varying(120), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "CHK_00212f90fa54ad61fda5451f5a" CHECK ("total_points" >= 0), CONSTRAINT "PK_a3ffb1c0c8416b9fc6f907b7433" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_97672ac88f789774dd47f7c8be" ON "users" ("email") `);
        await queryRunner.query(`CREATE TABLE "challenge_completions" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "user_id" uuid NOT NULL, "challenge_id" uuid NOT NULL, "points_earned" integer NOT NULL, "listen_percentage" real NOT NULL, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "CHK_953edf2424418b4b79f3fa0678" CHECK ("listen_percentage" >= 0 AND "listen_percentage" <= 100), CONSTRAINT "CHK_56d135c10e820c3521e7141694" CHECK ("points_earned" >= 0), CONSTRAINT "PK_02cdc0f2c385611ee53c90a38f8" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_9e46cf16e1b7e12891d0ed9a73" ON "challenge_completions" ("user_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_42dd5413383efb41c6bb32dfd6" ON "challenge_completions" ("challenge_id") `);
        await queryRunner.query(`CREATE TYPE "public"."challenge_difficulty_enum" AS ENUM('easy', 'medium', 'hard')`);
        await queryRunner.query(`CREATE TABLE "challenges" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "title" character varying(160) NOT NULL, "artist" character varying(160) NOT NULL, "description" text NOT NULL, "points" integer NOT NULL, "duration_seconds" integer NOT NULL, "difficulty" "public"."challenge_difficulty_enum" NOT NULL, "is_active" boolean NOT NULL DEFAULT true, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "CHK_db3fc1d543e050b264362ad2d0" CHECK ("duration_seconds" > 0), CONSTRAINT "CHK_c80bcc2edcc29f844967d70b09" CHECK ("points" > 0), CONSTRAINT "PK_1e664e93171e20fe4d6125466af" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_1e30f6e9131273fabce6164f31" ON "challenges" ("difficulty") `);
        await queryRunner.query(`CREATE INDEX "IDX_32beeb38a59e56f8030d4f18cf" ON "challenges" ("is_active") `);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_challenges_title_artist_unique" ON "challenges" ("title", "artist") `);
        await queryRunner.query(`ALTER TABLE "reward_redemptions" ADD CONSTRAINT "FK_8e40cc924716518bc5d1828ce3d" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "reward_redemptions" ADD CONSTRAINT "FK_6b13532c084052b9d0a749f8edb" FOREIGN KEY ("reward_id") REFERENCES "rewards"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "user_tokens" ADD CONSTRAINT "FK_9e144a67be49e5bba91195ef5de" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "challenge_completions" ADD CONSTRAINT "FK_9e46cf16e1b7e12891d0ed9a738" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "challenge_completions" ADD CONSTRAINT "FK_42dd5413383efb41c6bb32dfd6e" FOREIGN KEY ("challenge_id") REFERENCES "challenges"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "challenge_completions" DROP CONSTRAINT "FK_42dd5413383efb41c6bb32dfd6e"`);
        await queryRunner.query(`ALTER TABLE "challenge_completions" DROP CONSTRAINT "FK_9e46cf16e1b7e12891d0ed9a738"`);
        await queryRunner.query(`ALTER TABLE "user_tokens" DROP CONSTRAINT "FK_9e144a67be49e5bba91195ef5de"`);
        await queryRunner.query(`ALTER TABLE "reward_redemptions" DROP CONSTRAINT "FK_6b13532c084052b9d0a749f8edb"`);
        await queryRunner.query(`ALTER TABLE "reward_redemptions" DROP CONSTRAINT "FK_8e40cc924716518bc5d1828ce3d"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_challenges_title_artist_unique"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_32beeb38a59e56f8030d4f18cf"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_1e30f6e9131273fabce6164f31"`);
        await queryRunner.query(`DROP TABLE "challenges"`);
        await queryRunner.query(`DROP TYPE "public"."challenge_difficulty_enum"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_42dd5413383efb41c6bb32dfd6"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_9e46cf16e1b7e12891d0ed9a73"`);
        await queryRunner.query(`DROP TABLE "challenge_completions"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_97672ac88f789774dd47f7c8be"`);
        await queryRunner.query(`DROP TABLE "users"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_d777f2f34aa5b93dc2a1c62a78"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_497411b2dd739450fbd25f7db7"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_fa382ad99ae6a6058ae8d12325"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_9e144a67be49e5bba91195ef5d"`);
        await queryRunner.query(`DROP TABLE "user_tokens"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_9cb988ade6c1d825c2535e7667"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_6b13532c084052b9d0a749f8ed"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_8e40cc924716518bc5d1828ce3"`);
        await queryRunner.query(`DROP TABLE "reward_redemptions"`);
        await queryRunner.query(`DROP TYPE "public"."reward_redemption_status_enum"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_36bebf78f11fd93825303233b6"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_1d7ed66691090d50235bfd7582"`);
        await queryRunner.query(`DROP TABLE "rewards"`);
    }

}
