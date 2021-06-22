namespace NoteAppUI
{
    partial class AboutForm
    {
        /// <summary>
        /// Required designer variable.
        /// </summary>
        private System.ComponentModel.IContainer components = null;

        /// <summary>
        /// Clean up any resources being used.
        /// </summary>
        /// <param name="disposing">true if managed resources should be disposed; otherwise, false.</param>
        protected override void Dispose(bool disposing)
        {
            if (disposing && (components != null))
            {
                components.Dispose();
            }
            base.Dispose(disposing);
        }

        #region Windows Form Designer generated code

        /// <summary>
        /// Required method for Designer support - do not modify
        /// the contents of this method with the code editor.
        /// </summary>
        private void InitializeComponent()
        {
            this.label1 = new System.Windows.Forms.Label();
            this.label2 = new System.Windows.Forms.Label();
            this.label3 = new System.Windows.Forms.Label();
            this.label4 = new System.Windows.Forms.Label();
            this.label5 = new System.Windows.Forms.Label();
            this.label6 = new System.Windows.Forms.Label();
            this.LinkMail = new System.Windows.Forms.Label();
            this.LinkGitHub = new System.Windows.Forms.Label();
            this.SuspendLayout();
            // 
            // label1
            // 
            this.label1.AutoSize = true;
            this.label1.Font = new System.Drawing.Font("Microsoft Sans Serif", 27.75F, System.Drawing.FontStyle.Bold, System.Drawing.GraphicsUnit.Point, ((byte)(204)));
            this.label1.Location = new System.Drawing.Point(40, 38);
            this.label1.Margin = new System.Windows.Forms.Padding(4, 0, 4, 0);
            this.label1.Name = "label1";
            this.label1.Size = new System.Drawing.Size(212, 54);
            this.label1.TabIndex = 0;
            this.label1.Text = "NoteApp";
            // 
            // label2
            // 
            this.label2.AutoSize = true;
            this.label2.Location = new System.Drawing.Point(45, 107);
            this.label2.Margin = new System.Windows.Forms.Padding(4, 0, 4, 0);
            this.label2.Name = "label2";
            this.label2.Size = new System.Drawing.Size(55, 17);
            this.label2.TabIndex = 1;
            this.label2.Text = "v. 1.0.0";
            // 
            // label3
            // 
            this.label3.AutoSize = true;
            this.label3.Location = new System.Drawing.Point(45, 148);
            this.label3.Margin = new System.Windows.Forms.Padding(4, 0, 4, 0);
            this.label3.Name = "label3";
            this.label3.Size = new System.Drawing.Size(196, 17);
            this.label3.TabIndex = 2;
            this.label3.Text = "Author: Solovyova Anastasiya";
            this.label3.Click += new System.EventHandler(this.label3_Click);
            // 
            // label4
            // 
            this.label4.AutoSize = true;
            this.label4.Location = new System.Drawing.Point(45, 183);
            this.label4.Margin = new System.Windows.Forms.Padding(4, 0, 4, 0);
            this.label4.Name = "label4";
            this.label4.Size = new System.Drawing.Size(137, 17);
            this.label4.TabIndex = 3;
            this.label4.Text = "e-mail. for feedback:";
            // 
            // label5
            // 
            this.label5.AutoSize = true;
            this.label5.Location = new System.Drawing.Point(45, 217);
            this.label5.Margin = new System.Windows.Forms.Padding(4, 0, 4, 0);
            this.label5.Name = "label5";
            this.label5.Size = new System.Drawing.Size(56, 17);
            this.label5.TabIndex = 4;
            this.label5.Text = "GitHub:";
            // 
            // label6
            // 
            this.label6.AutoSize = true;
            this.label6.Location = new System.Drawing.Point(45, 432);
            this.label6.Margin = new System.Windows.Forms.Padding(4, 0, 4, 0);
            this.label6.Name = "label6";
            this.label6.Size = new System.Drawing.Size(204, 17);
            this.label6.TabIndex = 5;
            this.label6.Text = "2021 Anastasiya Solovyova ©  \r\n";
            // 
            // LinkMail
            // 
            this.LinkMail.AutoSize = true;
            this.LinkMail.Cursor = System.Windows.Forms.Cursors.Hand;
            this.LinkMail.Font = new System.Drawing.Font("Microsoft Sans Serif", 8.25F, System.Drawing.FontStyle.Underline, System.Drawing.GraphicsUnit.Point, ((byte)(204)));
            this.LinkMail.ForeColor = System.Drawing.SystemColors.MenuHighlight;
            this.LinkMail.Location = new System.Drawing.Point(179, 183);
            this.LinkMail.Margin = new System.Windows.Forms.Padding(4, 0, 4, 0);
            this.LinkMail.Name = "LinkMail";
            this.LinkMail.Size = new System.Drawing.Size(286, 17);
            this.LinkMail.TabIndex = 6;
            this.LinkMail.Text = "anastasiya_nastya_soloveva_2000@mail.ru";
            this.LinkMail.Click += new System.EventHandler(this.LinkMail_Click);
            // 
            // LinkGitHub
            // 
            this.LinkGitHub.AutoSize = true;
            this.LinkGitHub.Cursor = System.Windows.Forms.Cursors.Hand;
            this.LinkGitHub.Font = new System.Drawing.Font("Microsoft Sans Serif", 8.25F, System.Drawing.FontStyle.Underline, System.Drawing.GraphicsUnit.Point, ((byte)(204)));
            this.LinkGitHub.ForeColor = System.Drawing.SystemColors.Highlight;
            this.LinkGitHub.Location = new System.Drawing.Point(100, 217);
            this.LinkGitHub.Margin = new System.Windows.Forms.Padding(4, 0, 4, 0);
            this.LinkGitHub.Name = "LinkGitHub";
            this.LinkGitHub.Size = new System.Drawing.Size(168, 17);
            this.LinkGitHub.TabIndex = 7;
            this.LinkGitHub.Text = "Anastasiya5883/NoteApp";
            this.LinkGitHub.Click += new System.EventHandler(this.LinkGitHub_Click);
            // 
            // AboutForm
            // 
            this.AutoScaleDimensions = new System.Drawing.SizeF(8F, 16F);
            this.AutoScaleMode = System.Windows.Forms.AutoScaleMode.Font;
            this.ClientSize = new System.Drawing.Size(643, 459);
            this.Controls.Add(this.LinkGitHub);
            this.Controls.Add(this.LinkMail);
            this.Controls.Add(this.label6);
            this.Controls.Add(this.label5);
            this.Controls.Add(this.label4);
            this.Controls.Add(this.label3);
            this.Controls.Add(this.label2);
            this.Controls.Add(this.label1);
            this.FormBorderStyle = System.Windows.Forms.FormBorderStyle.FixedDialog;
            this.Margin = new System.Windows.Forms.Padding(4);
            this.Name = "AboutForm";
            this.Text = "About";
            this.ResumeLayout(false);
            this.PerformLayout();

        }

        #endregion

        private System.Windows.Forms.Label label1;
        private System.Windows.Forms.Label label2;
        private System.Windows.Forms.Label label3;
        private System.Windows.Forms.Label label4;
        private System.Windows.Forms.Label label5;
        private System.Windows.Forms.Label label6;
        private System.Windows.Forms.Label LinkMail;
        public System.Windows.Forms.Label LinkGitHub;
    }
}