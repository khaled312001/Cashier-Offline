CREATE TABLE `branches` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`public_id` text NOT NULL,
	`name` text NOT NULL,
	`address` text,
	`phone` text,
	`is_active` integer DEFAULT true NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `categories` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`public_id` text NOT NULL,
	`name` text NOT NULL,
	`name_en` text,
	`parent_id` integer,
	`color` text,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`is_active` integer DEFAULT true NOT NULL,
	`deleted_at` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_categories_parent` ON `categories` (`parent_id`);--> statement-breakpoint
CREATE TABLE `product_barcodes` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`product_id` integer NOT NULL,
	`barcode` text NOT NULL,
	`variant_id` integer,
	`pack_size` real DEFAULT 1 NOT NULL,
	FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_barcode` ON `product_barcodes` (`barcode`);--> statement-breakpoint
CREATE TABLE `product_prices` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`product_id` integer NOT NULL,
	`branch_id` integer DEFAULT 1 NOT NULL,
	`price_level` integer DEFAULT 0 NOT NULL,
	`price` integer NOT NULL,
	FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_prices_uniq` ON `product_prices` (`product_id`,`branch_id`,`price_level`);--> statement-breakpoint
CREATE TABLE `product_variants` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`public_id` text NOT NULL,
	`product_id` integer NOT NULL,
	`name` text NOT NULL,
	`sku` text,
	`sell_price` integer,
	`cost_price` integer,
	`is_active` integer DEFAULT true NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `products` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`public_id` text NOT NULL,
	`sku` text,
	`name` text NOT NULL,
	`name_en` text,
	`category_id` integer,
	`unit_id` integer,
	`cost_price` integer DEFAULT 0 NOT NULL,
	`sell_price` integer DEFAULT 0 NOT NULL,
	`tax_rate_bp` integer DEFAULT 0 NOT NULL,
	`tax_inclusive` integer DEFAULT true NOT NULL,
	`is_weighed` integer DEFAULT false NOT NULL,
	`track_stock` integer DEFAULT true NOT NULL,
	`is_active` integer DEFAULT true NOT NULL,
	`allow_price_edit` integer DEFAULT false NOT NULL,
	`reorder_level` real DEFAULT 0 NOT NULL,
	`image_path` text,
	`has_variants` integer DEFAULT false NOT NULL,
	`has_modifiers` integer DEFAULT false NOT NULL,
	`is_combo` integer DEFAULT false NOT NULL,
	`kitchen_section_id` integer,
	`deleted_at` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`category_id`) REFERENCES `categories`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`unit_id`) REFERENCES `units`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_products_category` ON `products` (`category_id`);--> statement-breakpoint
CREATE INDEX `idx_products_sku` ON `products` (`sku`);--> statement-breakpoint
CREATE INDEX `idx_products_active` ON `products` (`is_active`);--> statement-breakpoint
CREATE TABLE `units` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`name_en` text,
	`short_code` text,
	`allow_decimal` integer DEFAULT false NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `batches` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`product_id` integer NOT NULL,
	`branch_id` integer DEFAULT 1 NOT NULL,
	`batch_no` text,
	`expiry_date` integer,
	`quantity` real DEFAULT 0 NOT NULL,
	`cost_price` integer DEFAULT 0 NOT NULL,
	`received_at` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_batches_expiry` ON `batches` (`expiry_date`);--> statement-breakpoint
CREATE TABLE `inventory_movements` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`public_id` text NOT NULL,
	`branch_id` integer DEFAULT 1 NOT NULL,
	`product_id` integer NOT NULL,
	`variant_id` integer,
	`batch_id` integer,
	`type` text NOT NULL,
	`quantity` real NOT NULL,
	`unit_cost` integer DEFAULT 0 NOT NULL,
	`ref_table` text,
	`ref_id` integer,
	`reason` text,
	`user_id` integer,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_mov_product_date` ON `inventory_movements` (`product_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `idx_mov_ref` ON `inventory_movements` (`ref_table`,`ref_id`);--> statement-breakpoint
CREATE TABLE `stock` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`branch_id` integer DEFAULT 1 NOT NULL,
	`product_id` integer NOT NULL,
	`variant_id` integer,
	`quantity` real DEFAULT 0 NOT NULL,
	`avg_cost` integer DEFAULT 0 NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_stock_uniq` ON `stock` (`branch_id`,`product_id`,`variant_id`);--> statement-breakpoint
CREATE TABLE `stocktake_lines` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`session_id` integer NOT NULL,
	`product_id` integer NOT NULL,
	`variant_id` integer,
	`system_qty` real DEFAULT 0 NOT NULL,
	`counted_qty` real,
	`diff_qty` real,
	`unit_cost` integer DEFAULT 0 NOT NULL,
	`counted_at` integer,
	FOREIGN KEY (`session_id`) REFERENCES `stocktake_sessions`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `stocktake_sessions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`public_id` text NOT NULL,
	`branch_id` integer DEFAULT 1 NOT NULL,
	`status` text DEFAULT 'open' NOT NULL,
	`started_by` integer,
	`started_at` integer NOT NULL,
	`completed_at` integer,
	`note` text
);
--> statement-breakpoint
CREATE TABLE `return_lines` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`return_id` integer NOT NULL,
	`sale_item_id` integer NOT NULL,
	`product_id` integer NOT NULL,
	`quantity` real NOT NULL,
	`amount` integer NOT NULL,
	`restock` integer DEFAULT true NOT NULL,
	FOREIGN KEY (`return_id`) REFERENCES `returns`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`sale_item_id`) REFERENCES `sale_items`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `returns` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`public_id` text NOT NULL,
	`original_sale_id` integer NOT NULL,
	`refund_sale_id` integer,
	`branch_id` integer DEFAULT 1 NOT NULL,
	`user_id` integer,
	`reason` text,
	`refund_method` text,
	`total_refunded` integer DEFAULT 0 NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`original_sale_id`) REFERENCES `sales`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `sale_item_modifiers` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`sale_item_id` integer NOT NULL,
	`modifier_id` integer,
	`name_snapshot` text NOT NULL,
	`price` integer DEFAULT 0 NOT NULL,
	`quantity` real DEFAULT 1 NOT NULL,
	FOREIGN KEY (`sale_item_id`) REFERENCES `sale_items`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `sale_items` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`sale_id` integer NOT NULL,
	`branch_id` integer DEFAULT 1 NOT NULL,
	`product_id` integer NOT NULL,
	`variant_id` integer,
	`batch_id` integer,
	`name_snapshot` text NOT NULL,
	`quantity` real NOT NULL,
	`unit` text,
	`unit_price` integer NOT NULL,
	`cost_price` integer DEFAULT 0 NOT NULL,
	`discount` integer DEFAULT 0 NOT NULL,
	`tax_rate_bp` integer DEFAULT 0 NOT NULL,
	`tax_amount` integer DEFAULT 0 NOT NULL,
	`line_total` integer NOT NULL,
	`is_weighed` integer DEFAULT false NOT NULL,
	`kitchen_status` text,
	`refunded_qty` real DEFAULT 0 NOT NULL,
	`note` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`sale_id`) REFERENCES `sales`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_saleitems_sale` ON `sale_items` (`sale_id`);--> statement-breakpoint
CREATE INDEX `idx_saleitems_product` ON `sale_items` (`product_id`);--> statement-breakpoint
CREATE TABLE `sale_payments` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`sale_id` integer NOT NULL,
	`branch_id` integer DEFAULT 1 NOT NULL,
	`method` text NOT NULL,
	`amount` integer NOT NULL,
	`reference` text,
	`tendered` integer,
	`change` integer,
	`user_id` integer,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`sale_id`) REFERENCES `sales`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_payments_sale` ON `sale_payments` (`sale_id`);--> statement-breakpoint
CREATE INDEX `idx_payments_method_date` ON `sale_payments` (`method`,`created_at`);--> statement-breakpoint
CREATE TABLE `sales` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`public_id` text NOT NULL,
	`branch_id` integer DEFAULT 1 NOT NULL,
	`receipt_no` text,
	`status` text DEFAULT 'completed' NOT NULL,
	`order_type` text DEFAULT 'quick' NOT NULL,
	`table_id` integer,
	`customer_id` integer,
	`user_id` integer,
	`shift_id` integer,
	`subtotal` integer DEFAULT 0 NOT NULL,
	`discount_total` integer DEFAULT 0 NOT NULL,
	`discount_type` text,
	`tax_total` integer DEFAULT 0 NOT NULL,
	`service_charge` integer DEFAULT 0 NOT NULL,
	`rounding` integer DEFAULT 0 NOT NULL,
	`grand_total` integer DEFAULT 0 NOT NULL,
	`paid_total` integer DEFAULT 0 NOT NULL,
	`change_due` integer DEFAULT 0 NOT NULL,
	`due_amount` integer DEFAULT 0 NOT NULL,
	`note` text,
	`guest_count` integer,
	`invoice_serial` text,
	`invoice_uuid` text,
	`eta_status` text,
	`eta_submitted_at` integer,
	`voided_by` integer,
	`void_reason` text,
	`original_sale_id` integer,
	`created_at` integer NOT NULL,
	`completed_at` integer,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_sales_date` ON `sales` (`created_at`);--> statement-breakpoint
CREATE INDEX `idx_sales_status` ON `sales` (`status`);--> statement-breakpoint
CREATE INDEX `idx_sales_shift` ON `sales` (`shift_id`);--> statement-breakpoint
CREATE INDEX `idx_sales_customer` ON `sales` (`customer_id`);--> statement-breakpoint
CREATE TABLE `combo_items` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`combo_id` integer NOT NULL,
	`component_product_id` integer NOT NULL,
	`quantity` real DEFAULT 1 NOT NULL,
	`is_swappable` integer DEFAULT false NOT NULL,
	`extra_price` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`combo_id`) REFERENCES `combos`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`component_product_id`) REFERENCES `products`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `combos` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`product_id` integer NOT NULL,
	FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `floor_areas` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`name_en` text,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`is_active` integer DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE `kitchen_sections` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`printer_id` integer
);
--> statement-breakpoint
CREATE TABLE `kot_lines` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`kot_id` integer NOT NULL,
	`sale_item_id` integer,
	`quantity` real DEFAULT 1 NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	FOREIGN KEY (`kot_id`) REFERENCES `kot_tickets`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `kot_tickets` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`sale_id` integer NOT NULL,
	`ticket_no` text,
	`section_id` integer,
	`status` text DEFAULT 'open' NOT NULL,
	`printed_at` integer,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `modifier_groups` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`name_en` text,
	`min_select` integer DEFAULT 0 NOT NULL,
	`max_select` integer DEFAULT 1 NOT NULL,
	`is_required` integer DEFAULT false NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE `modifiers` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`group_id` integer NOT NULL,
	`name` text NOT NULL,
	`name_en` text,
	`price` integer DEFAULT 0 NOT NULL,
	`is_default` integer DEFAULT false NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`group_id`) REFERENCES `modifier_groups`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `product_modifier_groups` (
	`product_id` integer NOT NULL,
	`group_id` integer NOT NULL,
	PRIMARY KEY(`product_id`, `group_id`),
	FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`group_id`) REFERENCES `modifier_groups`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `tables` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`public_id` text NOT NULL,
	`area_id` integer,
	`branch_id` integer DEFAULT 1 NOT NULL,
	`name` text NOT NULL,
	`seats` integer DEFAULT 4 NOT NULL,
	`pos_x` real DEFAULT 0 NOT NULL,
	`pos_y` real DEFAULT 0 NOT NULL,
	`shape` text DEFAULT 'square' NOT NULL,
	`status` text DEFAULT 'available' NOT NULL,
	`current_sale_id` integer,
	`is_active` integer DEFAULT true NOT NULL,
	FOREIGN KEY (`area_id`) REFERENCES `floor_areas`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_tables_area` ON `tables` (`area_id`);--> statement-breakpoint
CREATE TABLE `customer_groups` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`discount_bp` integer DEFAULT 0 NOT NULL,
	`price_level` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE `customer_transactions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`customer_id` integer NOT NULL,
	`branch_id` integer DEFAULT 1 NOT NULL,
	`type` text NOT NULL,
	`amount` integer NOT NULL,
	`balance_after` integer DEFAULT 0 NOT NULL,
	`ref_table` text,
	`ref_id` integer,
	`note` text,
	`user_id` integer,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`customer_id`) REFERENCES `customers`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_custtx_customer_date` ON `customer_transactions` (`customer_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `customers` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`public_id` text NOT NULL,
	`name` text NOT NULL,
	`phone` text,
	`email` text,
	`address` text,
	`group_id` integer,
	`loyalty_points` integer DEFAULT 0 NOT NULL,
	`store_credit` integer DEFAULT 0 NOT NULL,
	`balance` integer DEFAULT 0 NOT NULL,
	`credit_limit` integer DEFAULT 0 NOT NULL,
	`tax_id` text,
	`is_active` integer DEFAULT true NOT NULL,
	`deleted_at` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`group_id`) REFERENCES `customer_groups`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_customers_phone` ON `customers` (`phone`);--> statement-breakpoint
CREATE TABLE `goods_received` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`public_id` text NOT NULL,
	`po_id` integer,
	`supplier_id` integer NOT NULL,
	`branch_id` integer DEFAULT 1 NOT NULL,
	`grn_no` text,
	`total` integer DEFAULT 0 NOT NULL,
	`received_by` integer,
	`received_at` integer NOT NULL,
	`note` text,
	FOREIGN KEY (`supplier_id`) REFERENCES `suppliers`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `goods_received_lines` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`grn_id` integer NOT NULL,
	`product_id` integer NOT NULL,
	`batch_id` integer,
	`quantity` real NOT NULL,
	`unit_cost` integer DEFAULT 0 NOT NULL,
	`expiry_date` integer,
	FOREIGN KEY (`grn_id`) REFERENCES `goods_received`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `po_lines` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`po_id` integer NOT NULL,
	`product_id` integer NOT NULL,
	`variant_id` integer,
	`quantity` real NOT NULL,
	`received_qty` real DEFAULT 0 NOT NULL,
	`unit_cost` integer DEFAULT 0 NOT NULL,
	`tax_rate_bp` integer DEFAULT 0 NOT NULL,
	`line_total` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`po_id`) REFERENCES `purchase_orders`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `purchase_orders` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`public_id` text NOT NULL,
	`branch_id` integer DEFAULT 1 NOT NULL,
	`supplier_id` integer NOT NULL,
	`po_no` text,
	`status` text DEFAULT 'draft' NOT NULL,
	`subtotal` integer DEFAULT 0 NOT NULL,
	`tax_total` integer DEFAULT 0 NOT NULL,
	`discount` integer DEFAULT 0 NOT NULL,
	`grand_total` integer DEFAULT 0 NOT NULL,
	`expected_at` integer,
	`note` text,
	`user_id` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`supplier_id`) REFERENCES `suppliers`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `supplier_payments` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`supplier_id` integer NOT NULL,
	`branch_id` integer DEFAULT 1 NOT NULL,
	`amount` integer NOT NULL,
	`method` text,
	`ref_table` text,
	`ref_id` integer,
	`balance_after` integer DEFAULT 0 NOT NULL,
	`note` text,
	`user_id` integer,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`supplier_id`) REFERENCES `suppliers`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `suppliers` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`public_id` text NOT NULL,
	`name` text NOT NULL,
	`phone` text,
	`email` text,
	`address` text,
	`tax_id` text,
	`balance` integer DEFAULT 0 NOT NULL,
	`is_active` integer DEFAULT true NOT NULL,
	`deleted_at` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `audit_log` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` integer,
	`action` text NOT NULL,
	`entity` text,
	`entity_id` integer,
	`detail` text,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_audit_user_date` ON `audit_log` (`user_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `idx_audit_entity` ON `audit_log` (`entity`,`entity_id`);--> statement-breakpoint
CREATE TABLE `permissions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`key` text NOT NULL,
	`description` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `permissions_key_unique` ON `permissions` (`key`);--> statement-breakpoint
CREATE TABLE `role_permissions` (
	`role_id` integer NOT NULL,
	`permission_id` integer NOT NULL,
	PRIMARY KEY(`role_id`, `permission_id`),
	FOREIGN KEY (`role_id`) REFERENCES `roles`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`permission_id`) REFERENCES `permissions`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `roles` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`name_en` text,
	`is_system` integer DEFAULT false NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `users` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`public_id` text NOT NULL,
	`name` text NOT NULL,
	`username` text NOT NULL,
	`pin_hash` text,
	`password_hash` text,
	`role_id` integer NOT NULL,
	`branch_id` integer DEFAULT 1 NOT NULL,
	`is_active` integer DEFAULT true NOT NULL,
	`last_login_at` integer,
	`deleted_at` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`role_id`) REFERENCES `roles`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_username_unique` ON `users` (`username`);--> statement-breakpoint
CREATE TABLE `cash_movements` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`shift_id` integer NOT NULL,
	`branch_id` integer DEFAULT 1 NOT NULL,
	`type` text NOT NULL,
	`amount` integer NOT NULL,
	`reason` text,
	`user_id` integer,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`shift_id`) REFERENCES `shifts`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `expenses` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`public_id` text NOT NULL,
	`shift_id` integer,
	`branch_id` integer DEFAULT 1 NOT NULL,
	`category` text,
	`amount` integer NOT NULL,
	`description` text,
	`paid_to` text,
	`payment_method` text,
	`user_id` integer,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_expenses_date` ON `expenses` (`created_at`);--> statement-breakpoint
CREATE TABLE `shifts` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`public_id` text NOT NULL,
	`branch_id` integer DEFAULT 1 NOT NULL,
	`user_id` integer NOT NULL,
	`opened_at` integer NOT NULL,
	`closed_at` integer,
	`opening_float` integer DEFAULT 0 NOT NULL,
	`status` text DEFAULT 'open' NOT NULL,
	`expected_cash` integer DEFAULT 0 NOT NULL,
	`counted_cash` integer,
	`cash_diff` integer,
	`total_sales` integer DEFAULT 0 NOT NULL,
	`total_cash` integer DEFAULT 0 NOT NULL,
	`total_card` integer DEFAULT 0 NOT NULL,
	`total_other` integer DEFAULT 0 NOT NULL,
	`total_refunds` integer DEFAULT 0 NOT NULL,
	`total_discounts` integer DEFAULT 0 NOT NULL,
	`total_tax` integer DEFAULT 0 NOT NULL,
	`total_expenses` integer DEFAULT 0 NOT NULL,
	`txn_count` integer DEFAULT 0 NOT NULL,
	`z_report_json` text,
	`note` text
);
--> statement-breakpoint
CREATE INDEX `idx_shifts_user_date` ON `shifts` (`user_id`,`opened_at`);--> statement-breakpoint
CREATE TABLE `hardware_devices` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`kind` text NOT NULL,
	`port` text,
	`baud` integer,
	`protocol` text,
	`config_json` text,
	`is_active` integer DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE `printers` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`role` text DEFAULT 'receipt' NOT NULL,
	`interface` text,
	`type` text DEFAULT 'escpos' NOT NULL,
	`char_per_line` integer DEFAULT 48 NOT NULL,
	`codepage` text,
	`paper_width` text DEFAULT '80' NOT NULL,
	`open_drawer` integer DEFAULT false NOT NULL,
	`is_default` integer DEFAULT false NOT NULL,
	`is_active` integer DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE `settings` (
	`key` text PRIMARY KEY NOT NULL,
	`value` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `license_state` (
	`id` integer PRIMARY KEY NOT NULL,
	`customer_id` text,
	`customer_name` text,
	`license_type` text,
	`issued_at` integer,
	`expires_at` integer,
	`machine_id` text,
	`features_json` text,
	`status` text,
	`activated_at` integer,
	`last_verified_at` integer,
	`trial_started_at` integer,
	`raw_license` text
);
