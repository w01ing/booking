from flask import Flask, url_for
import app as flask_app

with flask_app.app.test_request_context():
    print("Available endpoints:")
    for rule in flask_app.app.url_map.iter_rules():
        print(f"{rule.endpoint}: {rule}")
        
    # Test the provider endpoint specifically
    print("\nTesting provider endpoint:")
    try:
        url = url_for('get_provider_available_timeslots', provider_id='prov1')
        print(f"URL for provider endpoint: {url}")
    except Exception as e:
        print(f"Error generating URL: {e}") 