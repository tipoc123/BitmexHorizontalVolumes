<?php

$since = $_REQUEST['since'];
$till = $_REQUEST['till'];
$new_data = $_REQUEST['new_data'];

$db = new PDO('mysql:dbname=bitmex', 'root', '[password]', array(PDO::MYSQL_ATTR_INIT_COMMAND => "SET NAMES utf8"));
$db->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
if (isset($new_data)) {
    $select_statement = $db->prepare("select * from trades where timestamp > ? and timestamp <= ? order by timestamp, microseconds");
} else {
    $select_statement = $db->prepare("select * from trades where timestamp >= ? and timestamp <= ? order by timestamp, microseconds");
}
$select_statement->execute(array($since, $till));
$trades = $select_statement->fetchAll(PDO::FETCH_ASSOC);

echo json_encode($trades);
