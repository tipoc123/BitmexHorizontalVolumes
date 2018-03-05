<?php

require_once('SwaggerClient-php/autoload.php');

$configuration = new \Swagger\Client\Configuration();
$configuration->setHost('https://www.bitmex.com/api/v1');

$apiClient = new \Swagger\Client\ApiClient($configuration);

$tradeApi = new \Swagger\Client\Api\TradeApi($apiClient);

$format = 'Y-m-d H:i:s';
//$start_time = DateTime::createFromFormat($format, '2009-02-15 15:16:17');

$end_time = null;

$db = new PDO('mysql:dbname=bitmex', 'root', '[password]', array(PDO::MYSQL_ATTR_INIT_COMMAND => "SET NAMES utf8"));
$db->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
$insert_statement = $db->prepare("insert into trades (`timestamp`, microseconds, side, size, price, trd_match_id) values(?,?,?,?,?,?)");

while (true) {
    if ($end_time == null) {
        $start_time = new DateTime();
        $start_time->setTimezone(new DateTimeZone("UTC"));
        $start_time->sub(new DateInterval('PT2S'));
    } else {
        $start_time = $end_time;
    }

    $end_time = new DateTime();
    $end_time->setTimezone(new DateTimeZone("UTC"));

    $start_time_str = $start_time->format($format);
    $end_time_str = $end_time->format($format);

    echo $start_time_str . "\n";
    echo $end_time_str . "\n";

    try {
        $response = $tradeApi->tradeGet('XBTUSD', null, array('timestamp', 'side', 'size', 'price', 'trdMatchID'), 500, null, true, $start_time_str, $end_time_str);
//        print_r($response);
//    usleep(2 * 1000000);
        foreach ($response as $trade) {
            $timestamp = $trade->getTimestamp();
            $side = $trade->getSide();
            $size = $trade->getSize();
            $price = $trade->getPrice();
            $trd_match_id = $trade->getTrdMatchId();

            $executed = $insert_statement->execute(array($timestamp->getTimestamp(), $timestamp->format('u'), $side, $size, $price, $trd_match_id));
        }
    } catch (Exception $ex) {
        file_put_contents("error.log", $ex->getMessage());

        $end_time = $start_time;
    }

    sleep(2);
}
