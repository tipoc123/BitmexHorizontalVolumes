<?php

$timestamp = time() - 86400;

$log_file = "delete_old_trades.txt";
file_put_contents($log_file, "delete old trades before $timestamp\n", FILE_APPEND);

$db = new PDO('mysql:dbname=bitmex', 'root', '[password]', array(PDO::MYSQL_ATTR_INIT_COMMAND => "SET NAMES utf8"));
$db->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
$delete_statement = $db->prepare("delete from trades where timestamp < ?");
$delete_statement->execute(array($timestamp));
