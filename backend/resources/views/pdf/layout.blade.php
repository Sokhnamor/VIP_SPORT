<!DOCTYPE html>
<html lang="fr">
<head>
    <meta charset="utf-8">
    <title>@yield('title')</title>
    <style>
        * { font-family: DejaVu Sans, sans-serif; }
        body { margin: 0; color: #111; font-size: @yield('font-size', '11px'); }
        h1 { font-size: 16px; margin: 0 0 4px; }
        h2 { font-size: 13px; margin: 10px 0 4px; }
        .muted { color: #555; }
        .small { font-size: 9px; }
        .right { text-align: right; }
        .center { text-align: center; }
        .bold { font-weight: bold; }
        table { width: 100%; border-collapse: collapse; }
        th, td { padding: 4px 5px; vertical-align: top; }
        table.grid th, table.grid td { border: 1px solid #bbb; }
        table.grid th { background: #eee; text-align: left; }
        .stamp { border: 2px solid #b00; color: #b00; padding: 4px 8px; font-weight: bold; display: inline-block; }
        hr { border: 0; border-top: 1px dashed #999; margin: 8px 0; }
    </style>
    @stack('styles')
</head>
<body>
@yield('content')
</body>
</html>
