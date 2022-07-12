//
//  ViewController.h
//  Terminal
//
//  Created by Joel Einbinder on 3/23/22.
//

#import <Cocoa/Cocoa.h>
#import <WebKit/WebKit.h>
#import "NodeTalker.h"

@interface ViewController : NSViewController<WKUIDelegate, WKScriptMessageHandler> {
    WKWebView* webView;
    NodeTalker* nodeTalker;
}
-(IBAction)reloadWindow:(id)sender;
@end

