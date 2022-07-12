//
//  ViewController.h
//  Terminal
//
//  Created by Joel Einbinder on 3/23/22.
//

#import <Cocoa/Cocoa.h>
#import <WebKit/WebKit.h>
#import "NodeTalker.h"
#include "D4WebPanel.h"

@interface ViewController : NSViewController<WKUIDelegate, WKScriptMessageHandler, NSWindowDelegate> {
    WKWebView* webView;
    NodeTalker* nodeTalker;
    D4WebPanel* panel;
}
-(IBAction)reloadWindow:(id)sender;
@end

